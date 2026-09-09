// Query name: Period
let
    Source = #table(
        type table [PeriodKey = number, Period = text, PeriodSort = number],
        {
            {202501, "Jan 2025", 1},
            {202502, "Feb 2025", 2},
            {202503, "Mar 2025", 3}
        }
    ),
    Typed = Table.TransformColumnTypes(
        Source,
        {{"PeriodKey", Int64.Type}, {"PeriodSort", Int64.Type}}
    )
in
    Typed
