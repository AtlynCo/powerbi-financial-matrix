using Microsoft.AnalysisServices.Tabular;
using JsonSerializer = System.Text.Json.JsonSerializer;

if (args.Length != 1)
    throw new ArgumentException("Provide the semantic-model definition folder.");

var database = TmdlSerializer.DeserializeDatabaseFromFolder(args[0]);
var model = database.Model ?? throw new InvalidOperationException("Missing model.");
var expectedTables = new[] { "Period", "Accounts", "Facts", "StatementLines", "BalanceFact", "BalanceLines", "CashFlowFact", "CashFlowLines" };
if (!model.Tables.Select(table => table.Name).Order().SequenceEqual(expectedTables.Order()))
    throw new InvalidOperationException("Unexpected parsed table set.");
if (model.Relationships.Count != 4)
    throw new InvalidOperationException("Expected four parsed relationships.");
foreach (var table in model.Tables)
{
    if (table.Partitions.Count != 1 || table.Partitions[0].Source is not MPartitionSource)
        throw new InvalidOperationException($"Expected one inline M partition for {table.Name}.");
}
foreach (var (tableName, measureName) in new[] {
    ("Facts", "Actual"), ("Facts", "Budget"), ("Facts", "Prior"),
    ("BalanceFact", "BS Actual"), ("BalanceFact", "BS Budget"), ("BalanceFact", "BS Prior"),
    ("CashFlowFact", "CF Actual"), ("CashFlowFact", "CF Budget"), ("CashFlowFact", "CF Prior")
})
{
    if (string.IsNullOrWhiteSpace(model.Tables[tableName].Measures[measureName].Expression))
        throw new InvalidOperationException($"Missing measure expression: {tableName}[{measureName}].");
}
foreach (SingleColumnRelationship relationship in model.Relationships)
{
    if (!relationship.IsActive || relationship.CrossFilteringBehavior != CrossFilteringBehavior.OneDirection ||
        relationship.FromCardinality != RelationshipEndCardinality.Many || relationship.ToCardinality != RelationshipEndCardinality.One)
        throw new InvalidOperationException($"Unexpected relationship semantics: {relationship.Name}.");
}
Console.WriteLine(JsonSerializer.Serialize(new {
    parser = "Microsoft.AnalysisServices 19.117.0 TmdlSerializer",
    runtime = Environment.Version.ToString(),
    tables = model.Tables.Count, relationships = model.Relationships.Count,
    measures = model.Tables.Sum(table => table.Measures.Count),
    scope = "Official local TMDL deserialization and object-reference validation only; no M/DAX execution, Desktop UI or PBIX."
}));
