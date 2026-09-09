// Query name: Facts
// Prior is the aligned prior-year month, stored against the current reporting period.
// Expenses are positive source costs. Only the visual metadata reverses their display.
let
    Seed = #table(
        type table [
            PeriodKey = number,
            AccountID = text,
            CustomerID = nullable text,
            Actual = nullable number,
            Budget = nullable number,
            Prior = nullable number
        ],
        {
            {202501, "PRODUCT", "C001", 60000, 55000, 50000},
            {202501, "PRODUCT", "C002", 40000, 40000, 35000},
            {202501, "SERVICE", "C001", 10000, 10000, 8000},
            {202501, "SERVICE", "C003", 15000, 15000, 12000},
            {202501, "LAUNCH", "C001", 1200, 0, null},
            {202501, "MATERIALS", null, 45000, 42000, 40000},
            {202501, "DELIVERY", null, 10000, 11000, 9000},
            {202501, "PAYROLL", null, 25000, 24000, 23000},
            {202501, "OCCUPANCY", null, 8000, 8000, 7500},
            {202501, "MARKETING", null, 7000, 8000, 6000},
            {202502, "PRODUCT", "C001", 65000, 62000, 52000},
            {202502, "PRODUCT", "C003", 45000, 43000, 38000},
            {202502, "SERVICE", "C001", 12000, 11000, 9000},
            {202502, "SERVICE", "C004", 18000, 16000, 14000},
            {202502, "LAUNCH", "C001", 2500, 1000, null},
            {202502, "MATERIALS", null, 48000, 47000, 42000},
            {202502, "DELIVERY", null, 11000, 11500, 9500},
            {202502, "PAYROLL", null, 26000, 25000, 24000},
            {202502, "OCCUPANCY", null, 8000, 8000, 7500},
            {202502, "MARKETING", null, 9000, 8500, 6500},
            {202503, "PRODUCT", "C002", 70000, 66000, 55000},
            {202503, "PRODUCT", "C003", 50000, 47000, 40000},
            {202503, "SERVICE", "C002", 13000, 12000, 10000},
            {202503, "SERVICE", "C004", 20000, 18000, 15000},
            {202503, "LAUNCH", "C002", 4000, 3000, null},
            {202503, "MATERIALS", null, 52000, 50000, 44000},
            {202503, "DELIVERY", null, 12000, 12000, 10000},
            {202503, "PAYROLL", null, 27000, 26000, 25000},
            {202503, "OCCUPANCY", null, 8200, 8000, 7800},
            {202503, "MARKETING", null, 8500, 9000, 7000}
        }
    ),
    Long = Table.Unpivot(Seed, {"Actual", "Budget", "Prior"}, "Scenario", "Amount"),
    Typed = Table.TransformColumnTypes(
        Long,
        {{"PeriodKey", Int64.Type}, {"Scenario", type text}, {"Amount", type number}}
    )
in
    Typed
