// Query name: CashFlowFact
// Opening is a stock; the other rows are already-classified signed cash movements.
let
    Seed = #table(
        type table [
            PeriodKey = number,
            Movement = text,
            Actual = number,
            Budget = number,
            Prior = number
        ],
        {
            {202501, "Opening", 45000, 46000, 37000},
            {202501, "Operating", 12000, 10000, 8000},
            {202501, "Investing", -10000, -11000, -7000},
            {202501, "Financing", 3000, 3000, 2000},
            {202502, "Opening", 50000, 48000, 40000},
            {202502, "Operating", 20000, 19000, 10000},
            {202502, "Investing", -12000, -11000, -8000},
            {202502, "Financing", 4000, 4000, 2000},
            {202503, "Opening", 62000, 60000, 44000},
            {202503, "Operating", 18000, 17000, 9000},
            {202503, "Investing", -11000, -11000, -9000},
            {202503, "Financing", 4000, 4000, 2000}
        }
    ),
    Long = Table.Unpivot(Seed, {"Actual", "Budget", "Prior"}, "Scenario", "Amount"),
    Typed = Table.TransformColumnTypes(
        Long,
        {{"PeriodKey", Int64.Type}, {"Scenario", type text}, {"Amount", type number}}
    )
in
    Typed
