// Query name: BalanceFact
// Synthetic period-end stocks, not transactions; do not sum across months.
let
    Seed = #table(
        type table [
            PeriodKey = number,
            AccountID = text,
            Actual = number,
            Budget = number,
            Prior = number
        ],
        {
            {202501, "CASH", 50000, 48000, 40000},
            {202501, "RECEIVABLE", 30000, 32000, 25000},
            {202501, "INVENTORY", 20000, 20000, 18000},
            {202501, "FIXED_ASSETS", 100000, 100000, 90000},
            {202501, "PAYABLE", 25000, 26000, 23000},
            {202501, "DEBT", 75000, 74000, 60000},
            {202501, "EQUITY", 100000, 100000, 90000},
            {202502, "CASH", 62000, 60000, 44000},
            {202502, "RECEIVABLE", 32000, 33000, 27000},
            {202502, "INVENTORY", 19000, 20000, 18000},
            {202502, "FIXED_ASSETS", 101000, 101000, 91000},
            {202502, "PAYABLE", 27000, 28000, 24000},
            {202502, "DEBT", 77000, 76000, 61000},
            {202502, "EQUITY", 110000, 110000, 95000},
            {202503, "CASH", 73000, 70000, 46000},
            {202503, "RECEIVABLE", 33000, 35000, 29000},
            {202503, "INVENTORY", 18000, 19000, 17000},
            {202503, "FIXED_ASSETS", 102000, 102000, 92000},
            {202503, "PAYABLE", 28000, 29000, 25000},
            {202503, "DEBT", 78000, 77000, 62000},
            {202503, "EQUITY", 120000, 120000, 97000}
        }
    ),
    Long = Table.Unpivot(Seed, {"Actual", "Budget", "Prior"}, "Scenario", "Amount"),
    Typed = Table.TransformColumnTypes(
        Long,
        {{"PeriodKey", Int64.Type}, {"Scenario", type text}, {"Amount", type number}}
    )
in
    Typed
