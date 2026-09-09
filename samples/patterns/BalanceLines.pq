// Query name: BalanceLines
// Disconnected from all fact/dimension tables.
let
    Source = #table(
        type table [LineID = text, LineOrder = number],
        {
            {"bs.cash", 10},
            {"bs.receivables", 20},
            {"bs.inventory", 30},
            {"bs.fixed-assets", 40},
            {"bs.assets", 50},
            {"bs.payables", 60},
            {"bs.debt", 70},
            {"bs.equity", 80},
            {"bs.liabilities-equity", 90},
            {"bs.check", 100}
        }
    ),
    Typed = Table.TransformColumnTypes(Source, {{"LineOrder", Int64.Type}})
in
    Typed
