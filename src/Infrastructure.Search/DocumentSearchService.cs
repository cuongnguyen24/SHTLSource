using Nest;
using Microsoft.Extensions.Options;

namespace Infrastructure.Search;

public class ElasticsearchOptions
{
    public string Uri { get; set; } = "http://localhost:9200";
    public string IndexPrefix { get; set; } = "shtl";
    public string? Username { get; set; }
    public string? Password { get; set; }
}

public class DocumentSearchDocument
{
    public long Id { get; set; }
    public int ChannelId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? SearchMeta { get; set; }
    public string? SymbolNo { get; set; }
    public string? RecordNo { get; set; }
    public string? IssuedBy { get; set; }
    public string? Author { get; set; }
    public string? Noted { get; set; }
    public string? Summary { get; set; }
    public string? Field1 { get; set; }
    public string? Field2 { get; set; }
    public string? Field3 { get; set; }
    public string? Field4 { get; set; }
    public string? Field5 { get; set; }
    public int DocTypeId { get; set; }
    public byte CurrentStep { get; set; }
    public byte Status { get; set; }
    public DateTime Created { get; set; }
    public int CreatedBy { get; set; }
}

public interface IDocumentSearchService
{
    Task IndexDocumentAsync(DocumentSearchDocument doc);
    Task<IEnumerable<DocumentSearchDocument>> SearchAsync(int channelId, string query, int from = 0, int size = 20);
    Task DeleteDocumentAsync(long id, int channelId);
}

public class DocumentSearchService : IDocumentSearchService
{
    private readonly IElasticClient _client;
    private readonly string _index;

    public DocumentSearchService(IOptions<ElasticsearchOptions> opts)
    {
        var options = opts.Value;
        var settings = new ConnectionSettings(new Uri(options.Uri))
            .DefaultIndex($"{options.IndexPrefix}_documents");

        if (!string.IsNullOrEmpty(options.Username))
            settings.BasicAuthentication(options.Username, options.Password);

        _client = new ElasticClient(settings);
        _index = $"{options.IndexPrefix}_documents";
    }

    public async Task IndexDocumentAsync(DocumentSearchDocument doc)
    {
        await _client.IndexDocumentAsync(doc);
    }

    public async Task<IEnumerable<DocumentSearchDocument>> SearchAsync(int channelId, string query, int from = 0, int size = 20)
    {
        var response = await _client.SearchAsync<DocumentSearchDocument>(s => s
            .Index(_index)
            .From(from)
            .Size(size)
            .Query(q => q
                .Bool(b => b
                    .Must(
                        m => m.Term(t => t.ChannelId, channelId),
                        m => m.MultiMatch(mm => mm
                            .Fields(f => f
                                .Field(x => x.Name)
                                .Field(x => x.SearchMeta)
                                .Field(x => x.SymbolNo)
                                .Field(x => x.RecordNo)
                                .Field(x => x.IssuedBy)
                                .Field(x => x.Author)
                                .Field(x => x.Noted)
                                .Field(x => x.Summary)
                            )
                            .Query(query)
                            .Type(TextQueryType.BestFields)
                        )
                    )
                )
            )
            .Sort(ss => ss.Descending(d => d.Id))
        );

        return response.Documents;
    }

    public async Task DeleteDocumentAsync(long id, int channelId)
    {
        await _client.DeleteAsync<DocumentSearchDocument>(id, d => d.Index(_index));
    }
}
