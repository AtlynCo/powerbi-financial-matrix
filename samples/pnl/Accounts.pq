// Query name: Accounts
let
    Source = #table(
        type table [AccountID = text, AccountLabel = text, StatementClass = text],
        {
            {"PRODUCT", "Product revenue", "Revenue"},
            {"SERVICE", "Service revenue", "Revenue"},
            {"LAUNCH", "New product revenue", "Revenue"},
            {"MATERIALS", "Materials", "CostOfSales"},
            {"DELIVERY", "Delivery", "CostOfSales"},
            {"PAYROLL", "Payroll", "OperatingExpense"},
            {"OCCUPANCY", "Occupancy", "OperatingExpense"},
            {"MARKETING", "Marketing", "OperatingExpense"}
        }
    )
in
    Source
