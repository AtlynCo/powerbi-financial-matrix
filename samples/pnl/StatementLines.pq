// Query name: StatementLines
// This table is disconnected: do not relate it to Accounts or Facts.
let
    Source = #table(
        type table [
            SectionID = text,
            SectionOrder = number,
            LineID = text,
            LineOrder = number
        ],
        {
            {"pl.revenue", 10, "pl.product-revenue", 11},
            {"pl.revenue", 10, "pl.service-revenue", 12},
            {"pl.revenue", 10, "pl.launch-revenue", 13},
            {"pl.cost-of-sales", 20, "pl.materials", 21},
            {"pl.cost-of-sales", 20, "pl.delivery", 22},
            {"pl.gross", 30, "pl.gross-profit", 31},
            {"pl.gross", 30, "pl.gross-margin", 32},
            {"pl.operating-expenses", 40, "pl.payroll", 41},
            {"pl.operating-expenses", 40, "pl.occupancy", 42},
            {"pl.operating-expenses", 40, "pl.marketing", 43},
            {"pl.results", 50, "pl.operating-profit", 51},
            {"pl.results", 50, "pl.operating-margin", 52},
            {"pl.results", 50, "pl.customers", 53}
        }
    ),
    Typed = Table.TransformColumnTypes(
        Source,
        {{"SectionOrder", Int64.Type}, {"LineOrder", Int64.Type}}
    )
in
    Typed
