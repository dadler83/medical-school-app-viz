import unittest

from admission_parsing import extract_school_from_page, find_page_section_starts, parse_course_rows


class TestSchoolNameParsing(unittest.TestCase):
    def test_unlv_multiline_school_name_is_preserved(self):
        lines = [
            "CAN",  # country marker can appear; not used as anchor in this test
            "NV",
            "Kirk Kerkorian",
            "School of Medicine",
            "at UNLV",
            "Biology",
            "BIOL",
            "Required",
        ]

        school_name, line_count = extract_school_from_page(lines, state_idx=1)

        self.assertEqual(
            school_name,
            "Kirk Kerkorian School of Medicine at UNLV",
        )
        self.assertEqual(line_count, 3)

    def test_two_schools_same_page_are_detected(self):
        lines = [
            "NY",
            "NYU Grossman",
            "School of Medicine",
            "Biochemistry",
            "CHEM",
            "Required",
            "NY",
            "NYU Grossman Long Island",
            "School of Medicine",
            "Creative Writing",
            "ENGL",
            "Recommended",
        ]

        starts = find_page_section_starts(lines)
        self.assertEqual(starts, [0, 6])

        school_1, school_1_lines = extract_school_from_page(lines, starts[0])
        school_2, school_2_lines = extract_school_from_page(lines, starts[1])

        self.assertEqual(school_1, "NYU Grossman School of Medicine")
        self.assertEqual(school_2, "NYU Grossman Long Island School of Medicine")
        self.assertEqual(school_1_lines, 2)
        self.assertEqual(school_2_lines, 2)

        rows_1, _ = parse_course_rows(lines, start_idx=3, end_idx=6)
        rows_2, _ = parse_course_rows(lines, start_idx=9, end_idx=len(lines))
        self.assertEqual(len(rows_1), 1)
        self.assertEqual(len(rows_2), 1)
        self.assertEqual(rows_1[0]["course"], "Biochemistry")
        self.assertEqual(rows_2[0]["course"], "Creative Writing")

    def test_school_name_stops_before_policy_text(self):
        lines = [
            "NV",
            "Kirk Kerkorian",
            "School of Medicine",
            "at UNLV",
            "Must receive",
            "an equivalent university credit",
            "Biology",
            "BIOL",
            "Required",
        ]

        school_name, line_count = extract_school_from_page(lines, state_idx=0)

        self.assertEqual(
            school_name,
            "Kirk Kerkorian School of Medicine at UNLV",
        )
        self.assertEqual(line_count, 3)

    def test_university_of_washington_school_name_is_extracted(self):
        lines = [
            "WA",
            "Medical School",
            "College of Medicine at the University of",
            "University of",
            "Washington School",
            "of Medicine",
            "Biology",
            "BIOL",
            "Required",
        ]

        school_name, line_count = extract_school_from_page(lines, state_idx=0)

        self.assertEqual(school_name, "University of Washington School of Medicine")
        self.assertEqual(line_count, 3)

    def test_albert_einstein_college_of_medicine_is_extracted(self):
        lines = [
            "NY",
            "Albert Einstein",
            "College of Medicine",
            "Biochemistry",
            "CHEM",
            "Recommended",
        ]

        school_name, line_count = extract_school_from_page(lines, state_idx=0)

        self.assertEqual(school_name, "Albert Einstein College of Medicine")
        self.assertEqual(line_count, 2)

    def test_university_of_massachusetts_th_chan_school_of_medicine_is_extracted(self):
        lines = [
            "MA",
            "University of",
            "Massachusetts T.H.",
            "Chan School of",
            "Medicine",
            "Biology",
            "BIOL",
            "Required",
        ]

        school_name, line_count = extract_school_from_page(lines, state_idx=0)

        self.assertEqual(school_name, "University of Massachusetts T.H. Chan School of Medicine")
        self.assertEqual(line_count, 4)

    def test_thomas_f_frist_jr_college_of_medicine_at_belmont_university_is_extracted(self):
        lines = [
            "TN",
            "Thomas F. Frist, Jr.",
            "College of Medicine",
            "at Belmont",
            "University",
            "Biochemistry",
            "CHEM",
            "Required",
        ]

        school_name, line_count = extract_school_from_page(lines, state_idx=0)

        self.assertEqual(school_name, "Thomas F. Frist, Jr. College of Medicine at Belmont University")
        self.assertEqual(line_count, 4)

    def test_university_of_arizona_college_of_medicine_phoenix_is_extracted(self):
        lines = [
            "AZ",
            "University of Arizona",
            "College of Medicine",
            "- Phoenix",
            "Biochemistry",
            "CHEM",
            "Required",
        ]

        school_name, line_count = extract_school_from_page(lines, state_idx=0)

        self.assertEqual(school_name, "University of Arizona College of Medicine - Phoenix")
        self.assertEqual(line_count, 3)

    def test_required_pre_line_not_appended_to_school_name(self):
        lines = [
            "FL",
            "Florida State",
            "University",
            "College of Medicine",
            "Required pre-",
            "requisite",
            "Composition & Rhetoric",
            "ENGL",
            "Required",
        ]

        school_name, line_count = extract_school_from_page(lines, state_idx=0)

        self.assertEqual(school_name, "Florida State University College of Medicine")
        self.assertEqual(line_count, 3)


if __name__ == "__main__":
    unittest.main()
