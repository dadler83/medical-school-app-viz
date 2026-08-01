# North American Medical School Relevance Review Tool

With hundreds of medical schools in North America with differing requirements, it is useful to be able to review which schools  are most relevant to your medical journey in terms of requirements, location, matriculation statistics, and/or additional programs.

I created this tool to help me and others with that. Enjoy!

## Structure

### Frontend

TODO

### Parsing

Data from [sources](#data-sourcing) used in the project has been parsed into usable formats using a combination of scripts and generative AI.

Parsing scripts are written in python and extract relevant data from PDFs, CSVs, and/or webpages; it is expected that the PDF parsing can be reran on future MSAR data. Required dependencies to run parsing are listed installable from the pyproject.toml.

## Install

TODO

## Data Sourcing

Data was collected on July 31st, 2026.

[Applicant and Matriculation Data](https://www.aamc.org/data-reports/students-residents/report/facts)

[Application Deadlines Data](https://students-residents.aamc.org/applying-medical-school-amcas/amcas-program-participating-medical-schools-and-deadlines)

[Course Requirements Data](https://students-residents.aamc.org/media/7041/download)