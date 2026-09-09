// Query name: CashFlowLines
// Disconnected from all fact/dimension tables.
let
    Source = #table(
        type table [LineID = text, LineOrder = number],
        {
            {"cf.opening", 10},
            {"cf.operating", 20},
            {"cf.investing", 30},
            {"cf.financing", 40},
            {"cf.net", 50},
            {"cf.closing", 60},
            {"cf.check", 70}
        }
    ),
    Typed = Table.TransformColumnTypes(Source, {{"LineOrder", Int64.Type}})
in
    Typed
