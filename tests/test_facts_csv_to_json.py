import unittest
from pathlib import Path

from facts_csv_to_json import parse_table


class TestFactsCsvParsing(unittest.TestCase):
    def test_matriculants_table_headers_and_state_fill(self):
        table = parse_table(Path("2025_FACTS_Table_matriculants.csv"))

        self.assertEqual(table["columns"][0]["field_name"], "state")
        self.assertEqual(table["columns"][1]["field_name"], "medical_school")
        self.assertEqual(table["columns"][2]["field_name"], "applications_total")
        self.assertEqual(table["columns"][7]["field_name"], "matriculants_total")

        self.assertGreater(len(table["rows"]), 1)
        self.assertEqual(table["rows"][0]["state"], "AL")
        self.assertEqual(table["rows"][1]["state"], "AL")
        self.assertEqual(table["rows"][1]["medical_school"], "South Alabama-Whiddon")

    def test_md_phd_table_headers_and_state_fill(self):
        table = parse_table(Path("2025_FACTS_Table_md_phd.csv"))

        self.assertEqual(table["columns"][3]["field_name"], "applications_in_state_pct")
        self.assertEqual(table["columns"][8]["field_name"], "matriculants_in_state_pct")
        self.assertEqual(table["rows"][0]["applications_total"], 300)
        self.assertEqual(table["rows"][1]["state"], "AL")


if __name__ == "__main__":
    unittest.main()