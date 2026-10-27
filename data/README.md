# Data

The data comes from the HESA Discover Uni dataset at https://www.hesa.ac.uk/kisdata.

Contains HESA Discover Uni data (HESA, www.hesa.ac.uk), licensed under CC BY 4.0

NSS figures pool final-year students from 2024-25 and 2025-26.

Missing data should not be read as a sign of course quality.

## Rebuild

1. Download the latest ZIP from https://www.hesa.ac.uk/kisdata into `data/raw/`.
2. Unzip it there.
3. Then run `python scripts/load_hesa.py`.

## O*NET

This includes information from the [O*NET 31.0 Database](https://www.onetcenter.org/database.html) by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). Used under the [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) license. O*NET® is a trademark of USDOL/ETA. Inkling has modified all or some of this information. USDOL/ETA has not approved, endorsed, or tested these modifications.

Files used (CSV, from the O*NET 31.0 download page): Occupation Data, Career Interest Types, Work Context, Work Context Categories, Content Model Reference, Career Interest Type Keywords. Save them in `data/raw/onet/`.

### Our changes to the O*NET information

- **Mapped to UK job groups.** Each of the 45 UK occupation groups in the HESA graduate job lists is linked to 3 to 12 O*NET occupations (`data/onet_map.json`). Muse Spark drafted the links; they were reviewed by hand and the edits are listed in that file under `_review`.
- **Averaged per UK group.** For each UK group we take the mean of its O*NET occupations' interest scores (RIASEC, 1 to 7) and selected work-context scores (1 to 5).
- **Weighted per subject.** Each HESA subject's profile is the average of its graduates' UK job groups, weighted by the share of graduates in each group (`data/subject_profiles.json`).
- **Selected measures only.** We use the six interest types and ten work-context measures; the rest of O*NET is not used.

Rebuild with `python scripts/onet_profiles.py`.
