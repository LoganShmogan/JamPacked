// Every record is kept for at least this long. MPI's National Programmes require 4 years;
// this app keeps everything for 7 (matching NZ business record-keeping) and never deletes
// records at all: they are voided with a reason, and businesses are archived.
export const RETENTION_YEARS = 7;

