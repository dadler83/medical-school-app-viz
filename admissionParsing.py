import hashlib
import json
import argparse
from datetime import datetime, timezone
from pathlib import Path

import PyPDF2

import re
from PyPDF2 import PdfReader, PdfWriter
from PyPDF2.generic import NameObject, TextStringObject, DecodedStreamObject


US_STATE_CODES = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
    "DC", "PR",
}

CANADA_PROVINCE_CODES = {
    "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
}

LOCATION_CODES = US_STATE_CODES | CANADA_PROVINCE_CODES
COUNTRY_MARKERS = {"USA", "CAN"}

HEADER_EXACT = {
    "USA", "CAN", "State", "Medical School", "Course", "Class", "Required or",
    "Recommended?", "Additional Info", "Credit", "Hours", "Lab?", "Pass",
    "/Fail", "AP", "Online", "Communit", ": No",
    ": Case-by-Case", ": Yes",
}

REQUIREMENT_LEVELS = {"Required", "Recommended"}
SCHOOL_NAME_KEYWORDS = {
    "school", "college", "university", "medicine", "medical", "health",
    "sciences", "institute", "program", "faculty", "campus",
}


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


def replace_images_with_text_at_location(input_pdf, output_pdf):
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

                    # Not Required (red img)
                    if uid in {6, 11}:
                        uid = "No"
                    # Required (green img)
                    elif uid in {10, 9}:
                        uid = "Yes"
                    # Case-by-case (yellow img)
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


def text_extraction_example(pdf_name):
    # Open the PDF file
    with open(pdf_name, 'rb') as pdf_file:
        pdf_reader = PyPDF2.PdfReader(pdf_file)

        # Extract text from the first page
        page = pdf_reader.pages[1]
        text = page.extract_text()
        print(text)


def slugify_school_name(name):
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return slug or "unknown_school"


def clean_page_lines(raw_text):
    lines = []
    for raw in raw_text.splitlines():
        line = re.sub(r"\s+", " ", raw).strip()
        if not line:
            continue
        if line in HEADER_EXACT:
            continue
        if line.startswith("\u00a9"):
            continue
        if "Association of American Medical Colleges" in line:
            continue
        if "and distributed with attribution for individual, educational, and noncommercial purposes only." in line:
            continue
        if line in {"2025", "2026", "\ufffd"}:
            continue
        if set(line) == {"\ufffd"}:
            continue
        if "Medical School Admission Requirements" in line:
            continue
        if "Premed Course Requirements" in line:
            continue
        lines.append(line)
    return lines


def is_noise_line(line):
    lowered = line.lower()
    if "association of american medical colleges" in lowered:
        return True
    if "and distributed with attribution" in lowered:
        return True
    if "noncommercial purposes only" in lowered:
        return True

    replacement_char_count = line.count("\ufffd")
    if replacement_char_count >= 3:
        return True

    # Remove lines that are mostly punctuation/symbol debris.
    alnum_count = sum(1 for c in line if c.isalnum())
    if alnum_count == 0:
        return True

    return False


def is_class_code(line):
    return bool(re.fullmatch(r"[A-Z]{2,6}", line))


def is_requirement_level(line):
    return line in REQUIREMENT_LEVELS


def is_course_start(lines, idx):
    if idx + 1 >= len(lines):
        return False
    if not any(ch.isalpha() for ch in lines[idx]):
        return False
    if not is_class_code(lines[idx + 1]):
        return False
    if lines[idx] in LOCATION_CODES or lines[idx] in COUNTRY_MARKERS:
        return False
    if lines[idx + 1] in LOCATION_CODES or lines[idx + 1] in COUNTRY_MARKERS:
        return False
    return True


def looks_like_policy_line(line):
    lowered = line.lower()
    if lowered.startswith("we ") or lowered.startswith("must ") or lowered.startswith("if "):
        return True
    if lowered.startswith("depending ") or "accept" in lowered or "applicant" in lowered:
        return True
    if "coursework" in lowered or "prerequisite" in lowered or "semester" in lowered:
        return True

    # Keep school fragments like "University in St." or "Louis School of" from
    # being mistaken for policy text just because they end with a period.
    if line.endswith(".") and len(line.split()) >= 4:
        return True

    return False


def is_generic_school_heading(line):
    lowered = re.sub(r"\s+", " ", line.strip().lower())
    return lowered in {"medical school", "college of medicine", "college of medicine at the university of"}


def looks_like_school_line(line, school_started=False):
    if is_class_code(line) or is_requirement_level(line) or line in LOCATION_CODES or line in COUNTRY_MARKERS:
        return False
    if is_generic_school_heading(line):
        return school_started

    lowered = line.lower()
    if school_started and re.match(r"^[-\u2013]\s*[A-Z][A-Za-z .'-]*$", line):
        return True
    if school_started and re.match(r"^(of|at|and|the|de|du|des)\b", lowered):
        return True

    has_keyword = any(token in lowered for token in SCHOOL_NAME_KEYWORDS)
    titleish = line[:1].isupper() and len(line) < 80
    policy_lead = re.match(
        r"^(must|we|if|courses?|credit|online|pass|lab|prerequisite|depending|required|recommended|the record|admissions?)\b",
        lowered,
    )

    if has_keyword:
        return True
    if school_started and titleish and not policy_lead and not re.search(r"\d", line):
        return True
    if not school_started and titleish and not line.endswith(".") and not policy_lead and not re.search(r"\d", line):
        return True
    return False


def looks_like_school_prefix_candidate(line):
    """Allow title-case lead-in fragments before the line with school keywords.

    Example: "Kirk Kerkorian" + "School of Medicine at UNLV"
    """
    if is_class_code(line) or is_requirement_level(line) or line in LOCATION_CODES or line in COUNTRY_MARKERS:
        return False
    if is_generic_school_heading(line):
        return False

    lowered = line.lower()
    if re.match(r"^(must|we|if|courses?|credit|online|pass|lab|prerequisite|depending)\b", lowered):
        return False

    # Allow common name suffix punctuation (e.g., "Jr.") while still
    # rejecting most sentence-like trailing periods.
    allow_trailing_period = bool(re.search(r",\s*(jr|sr)\.$", lowered))

    return (
        line[:1].isupper()
        and len(line) < 80
        and not re.search(r"\d", line)
        and (not line.endswith(".") or allow_trailing_period)
    )


def extract_school_from_page(lines, state_idx):
    start = state_idx + 1
    school_lines = []

    for idx in range(start, min(start + 12, len(lines))):
        line = lines[idx]
        if is_course_start(lines, idx):
            break
        if looks_like_policy_line(line) and school_lines and not looks_like_school_line(line, school_started=True):
            break

        if not school_lines and looks_like_school_prefix_candidate(line):
            # Keep a leading title-case fragment only when the next line clearly
            # continues into a school identifier.
            next_line = lines[idx + 1] if idx + 1 < len(lines) else ""
            if looks_like_school_line(next_line, school_started=True):
                school_lines.append(line)
                continue

        if looks_like_school_line(line, school_started=bool(school_lines)):
            school_lines.append(line)
            continue
        if school_lines:
            break

    return " ".join(school_lines).strip(), len(school_lines)


def parse_course_rows(lines, start_idx, end_idx=None):
    rows = []
    leftover = []
    idx = start_idx
    effective_end = len(lines) if end_idx is None else min(end_idx, len(lines))

    while idx < effective_end:
        if not is_course_start(lines, idx):
            leftover.append(lines[idx])
            idx += 1
            continue

        course_name = lines[idx]
        class_code = lines[idx + 1]
        cursor = idx + 2
        requirement_level = "Unknown"

        if cursor < len(lines) and is_requirement_level(lines[cursor]):
            requirement_level = lines[cursor]
            cursor += 1

        notes = []
        while cursor < effective_end and not is_course_start(lines, cursor):
            if lines[cursor] in LOCATION_CODES or lines[cursor] in COUNTRY_MARKERS:
                break
            if not is_noise_line(lines[cursor]):
                notes.append(lines[cursor])
            cursor += 1

        credit_hours = None
        compact_notes = []
        for item in notes:
            if credit_hours is None and re.fullmatch(r"\d+(?:\.\d+)?", item):
                credit_hours = float(item) if "." in item else int(item)
                continue
            compact_notes.append(item)

        # markers = {
        #     "yes": sum(1 for n in compact_notes if n == "Yes"),
        #     "no": sum(1 for n in compact_notes if n == "No"),
        #     "depends": sum(1 for n in compact_notes if n == "Depends"),
        # }

        rows.append(
            {
                "course": course_name,
                "class_code": class_code,
                "required_or_recommended": requirement_level,
                "credit_hours": credit_hours,
                # "markers": markers,
                "notes": " ".join(compact_notes).strip(),
                "raw_lines": compact_notes,
            }
        )
        idx = cursor

    return rows, leftover


def find_page_section_starts(lines):
    """Return indexes where a new school section begins on a page."""
    starts = []
    for idx, line in enumerate(lines):
        if line not in LOCATION_CODES:
            continue
        school_name, _ = extract_school_from_page(lines, idx)
        if school_name:
            starts.append(idx)
    return starts


def parse_msar_prerequisites_by_school(pdf_path):
    reader = PdfReader(pdf_path)
    schools = {}
    previous_school_slug = None

    for page_num, page in enumerate(reader.pages, start=1):
        raw_text = page.extract_text() or ""
        lines = clean_page_lines(raw_text)
        if not lines:
            continue

        section_starts = find_page_section_starts(lines)

        if not section_starts:
            if previous_school_slug and previous_school_slug in schools:
                schools[previous_school_slug]["page_notes"].append(
                    {
                        "page": page_num,
                        "notes": " ".join(line for line in lines[:40] if not is_noise_line(line)).strip(),
                    }
                )
            continue

        for section_pos, state_idx in enumerate(section_starts):
            section_end = section_starts[section_pos + 1] if section_pos + 1 < len(section_starts) else len(lines)
            state = lines[state_idx]
            school_name, school_line_count = extract_school_from_page(lines, state_idx)

            if not school_name:
                if previous_school_slug and previous_school_slug in schools:
                    schools[previous_school_slug]["page_notes"].append(
                        {
                            "page": page_num,
                            "notes": " ".join(
                                line for line in lines[state_idx:section_end] if not is_noise_line(line)
                            ).strip(),
                        }
                    )
                continue

            school_slug = slugify_school_name(school_name)
            dedupe_slug = school_slug
            suffix = 2
            while dedupe_slug in schools and schools[dedupe_slug]["school_name"] != school_name:
                dedupe_slug = f"{school_slug}_{suffix}"
                suffix += 1
            school_slug = dedupe_slug

            if school_slug not in schools:
                schools[school_slug] = {
                    "school_name": school_name,
                    "state": state,
                    "source_pages": [],
                    "prerequisite_courses": [],
                    "page_notes": [],
                }
            school_entry = schools[school_slug]

            start_idx = state_idx + 1
            if school_line_count > 0:
                start_idx = state_idx + school_line_count + 1

            rows, leftover = parse_course_rows(lines, start_idx, end_idx=section_end)

            school_entry["source_pages"].append(page_num)
            school_entry["source_pages"] = sorted(set(school_entry["source_pages"]))
            school_entry["prerequisite_courses"].extend(rows)

            if leftover:
                school_entry["page_notes"].append(
                    {
                        "page": page_num,
                        "notes": " ".join(line for line in leftover if not is_noise_line(line)).strip(),
                    }
                )

            previous_school_slug = school_slug

    # Ensure deterministic key ordering in output.
    ordered_slugs = sorted(schools.keys())
    ordered = {slug: schools[slug] for slug in ordered_slugs}
    return ordered


def parse_msar_pdf_to_school_json(
    input_pdf,
    output_json,
    normalized_pdf="output.pdf",
    normalize_images=True,
):
    parse_source_pdf = input_pdf
    if normalize_images:
        replace_images_with_text_at_location(input_pdf=input_pdf, output_pdf=normalized_pdf)
        parse_source_pdf = normalized_pdf

    schools = parse_msar_prerequisites_by_school(parse_source_pdf)
    payload = {
        "metadata": {
            "source_pdf": str(input_pdf),
            "normalized_pdf": str(parse_source_pdf),
            "parsed_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "total_schools": len(schools),
            "required_scope": ["prerequisite_courses"],
        },
        "schools": schools,
    }

    with open(output_json, "w", encoding="utf-8") as fp:
        json.dump(payload, fp, indent=2)

    print(f"Wrote school-divided JSON to {output_json}")
    print(f"Parsed {len(schools)} schools from {parse_source_pdf}")


def build_arg_parser():
    parser = argparse.ArgumentParser(
        description="Parse MSAR PDF into school-keyed JSON requirements."
    )
    parser.add_argument(
        "--input-pdf",
        default="MSAR002 - MSAR Premed Course Requirements.pdf",
        help="Path to source MSAR PDF.",
    )
    parser.add_argument(
        "--normalized-pdf",
        default="output.pdf",
        help="Path for normalized PDF with image markers replaced.",
    )
    parser.add_argument(
        "--output-json",
        default="msar_requirements_by_school.json",
        help="Destination JSON path.",
    )
    parser.add_argument(
        "--skip-normalize",
        action="store_true",
        help="Skip image normalization and parse the input PDF directly.",
    )
    return parser


if __name__ == '__main__':
    args = build_arg_parser().parse_args()
    parse_msar_pdf_to_school_json(
        input_pdf=args.input_pdf,
        output_json=args.output_json,
        normalized_pdf=args.normalized_pdf,
        normalize_images=not args.skip_normalize,
    )
