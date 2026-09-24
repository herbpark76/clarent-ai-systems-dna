/*
# Signal Desk — allow nullable system_layer for industry entries

## Purpose
The system_layer column was NOT NULL. With the new "industry" type
(business/market/education news with no clear technical layer),
system_layer needs to be nullable.

## Change
- ALTER COLUMN system_layer DROP NOT NULL
*/

ALTER TABLE signal_desk_entries ALTER COLUMN system_layer DROP NOT NULL;
