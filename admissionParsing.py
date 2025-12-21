import hashlib

import PyPDF2

import re
from PyPDF2 import PdfReader, PdfWriter
from PyPDF2.generic import NameObject, TextStringObject, DecodedStreamObject


def replace_image_with_text(input_pdf, output_pdf, image_name, replacement_text, x=100, y=500):
    """
    Replace an image in a PDF with text using PyPDF2 3.x+.
    """
    try:
        reader = PdfReader(input_pdf)
        writer = PdfWriter()

        for page in reader.pages:
            resources = page.get("/Resources")
            xobjects = resources.get("/XObject")

            if xobjects and NameObject(image_name) in xobjects:
                # Remove the image object from resources
                del xobjects[NameObject(image_name)]

                # Get and decode the page content
                content_data = page.get_contents().get_data().decode("latin-1")

                # Remove the image drawing command (e.g., "/Im0 Do")
                content_data = re.sub(rf"{re.escape(image_name)}\s+Do", "", content_data)

                # Add replacement text drawing commands
                text_cmd = (
                    "BT\n"  # Begin text object
                    "/F1 12 Tf\n"  # Font F1, size 12
                    f"{x} {y} Td\n"  # Move to position
                    f"({replacement_text}) Tj\n"  # Show text
                    "ET\n"  # End text object
                )
                content_data += "\n" + text_cmd

                # Wrap updated content into a DecodedStreamObject
                new_stream = DecodedStreamObject()
                new_stream.set_data(content_data.encode("latin-1"))
                page[NameObject("/Contents")] = new_stream

            writer.add_page(page)

        # Ensure font resource exists
        for page in writer.pages:
            resources = page.get("/Resources")
            fonts = resources.get("/Font")
            if fonts is None:
                fonts = {}
                resources[NameObject("/Font")] = fonts
            # Try to reuse an existing font from the first page
            first_page_fonts = reader.pages[0]["/Resources"].get("/Font", {})
            if "/F1" in first_page_fonts:
                fonts[NameObject("/F1")] = first_page_fonts["/F1"]

        with open(output_pdf, "wb") as f:
            writer.write(f)

        print(f"✅ Image '{image_name}' replaced with text in {output_pdf}")

    except Exception as e:
        print(f"❌ Error: {e}")


def replace_images_with_text_at_location(input_pdf, output_pdf, replacement_text="(Image removed)"):
    """
    Detects images in a PDF, gets their positions, removes them, and replaces them with text.
    Works with PyPDF2 3.x+.
    """
    try:
        reader = PdfReader(input_pdf)
        writer = PdfWriter()

        hash_to_uid = {}  # Map: image hash -> UID
        uid_counter = 1  # Increment for each new unique image

        # Regex to capture: a b c d e f cm /ImX Do
        cm_pattern = re.compile(
            r"([-+]?\d*\.?\d+)\s+"  # a (scale x)
            r"([-+]?\d*\.?\d+)\s+"  # b (skew y)
            r"([-+]?\d*\.?\d+)\s+"  # c (skew x)
            r"([-+]?\d*\.?\d+)\s+"  # d (scale y)
            r"([-+]?\d*\.?\d+)\s+"  # e (translate x)
            r"([-+]?\d*\.?\d+)\s+"  # f (translate y)
            r"cm\s+(/Im\d+)\s+Do"
        )

        for page_num, page in enumerate(reader.pages, start=1):
            resources = page.get("/Resources")
            xobjects = resources.get("/XObject")

            if not xobjects:
                writer.add_page(page)
                continue

            # Resolve indirect objects and find image names
            image_names = []
            for name, obj in xobjects.items():
                resolved_obj = obj.get_object()
                if resolved_obj.get("/Subtype") == "/Image":
                    image_names.append(name)

            if not image_names:
                writer.add_page(page)
                continue

            # Map image names to resolved objects
            image_map = {}
            for name, obj in xobjects.items():
                resolved_obj = obj.get_object()
                if resolved_obj.get("/Subtype") == "/Image":
                    image_map[name] = resolved_obj

            if not image_map:
                writer.add_page(page)
                continue

            content_data = page.get_contents().get_data().decode("latin-1")

            # Find all image draw commands with positions
            matches = cm_pattern.findall(content_data)

            for a, b, c, d, e, f, img_name in matches:
                if img_name in image_names:
                    img_obj = image_map[img_name]
                    img_data = img_obj.get_data()
                    img_hash = hashlib.sha256(img_data).hexdigest()

                    # Assign UID if new hash
                    if img_hash not in hash_to_uid:
                        hash_to_uid[img_hash] = uid_counter
                        uid_counter += 1
                        print(f"Page {page_num}: New image {img_name} → UID {hash_to_uid[img_hash]}")
                    else:
                        print(f"Page {page_num}: Duplicate image {img_name} → UID {hash_to_uid[img_hash]}")

                    uid = hash_to_uid[img_hash]

                    if uid in {6, 11}:
                        uid = "No"
                    elif uid in {10, 9}:
                        uid = "Yes"
                    elif uid in {7, 8, 12}:
                        uid = "Depends"

                    # Remove from resources
                    del xobjects[NameObject(img_name)]

                    # Remove the image drawing command
                    img_cmd_pattern = re.compile(
                        rf"{re.escape(a)}\s+{re.escape(b)}\s+{re.escape(c)}\s+"
                        rf"{re.escape(d)}\s+{re.escape(e)}\s+{re.escape(f)}\s+cm\s+"
                        rf"{re.escape(img_name)}\s+Do"
                    )
                    content_data = img_cmd_pattern.sub("", content_data)

                    # Insert replacement text at the same position
                    x = float(e)
                    y = float(f)
                    text_cmd = (
                        "BT\n"
                        "/F1 12 Tf\n"
                        f"{x} {y} Td\n"
                        f"({uid}) Tj\n"
                        "ET\n"
                    )
                    content_data += "\n" + text_cmd

                    print(f"Page {page_num}: Replaced {img_name} at ({x}, {y})")

            # Wrap updated content into a DecodedStreamObject
            new_stream = DecodedStreamObject()
            new_stream.set_data(content_data.encode("latin-1"))
            page[NameObject("/Contents")] = new_stream

            writer.add_page(page)

        # Ensure font resource exists
        for page in writer.pages:
            resources = page.get("/Resources")
            fonts = resources.get("/Font")
            if fonts is None:
                fonts = {}
                resources[NameObject("/Font")] = fonts
            first_page_fonts = reader.pages[0]["/Resources"].get("/Font", {})
            if "/F1" in first_page_fonts:
                fonts[NameObject("/F1")] = first_page_fonts["/F1"]

        with open(output_pdf, "wb") as f:
            writer.write(f)

        print(f"✅ All images replaced with text in {output_pdf}")

    except Exception as e:
        print(f"❌ Error: {e}")



# # Example usage
# replace_image_with_text(
#     input_pdf="input.pdf",
#     output_pdf="output.pdf",
#     image_name="/Im0",  # You must know the image XObject name
#     replacement_text="This was an image",
#     x=150,
#     y=400
# )


def text_extraction_example():
    # Open the PDF file
    with open('MSAR002 - MSAR Premed Course Requirements.pdf', 'rb') as pdf_file:
        pdf_reader = PyPDF2.PdfReader(pdf_file)

        # Extract text from the first page
        page = pdf_reader.pages[1]
        text = page.extract_text()
        print(text)


if __name__ == '__main__':
    with open('MSAR002 - MSAR Premed Course Requirements.pdf', 'rb') as pdf_file:
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        page = pdf_reader.pages[1]
        resources = page.get("/Resources")
        xobjects = resources.get("/XObject")
        print(xobjects)
    replace_images_with_text_at_location(
        input_pdf="MSAR002 - MSAR Premed Course Requirements.pdf",
        output_pdf="output.pdf"
    )
