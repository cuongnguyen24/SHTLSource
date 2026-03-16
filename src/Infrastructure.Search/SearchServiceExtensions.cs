using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure.Search;

public static class SearchServiceExtensions
{
    public static IServiceCollection AddInfrastructureSearch(
        this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<ElasticsearchOptions>(configuration.GetSection("Elasticsearch"));
        services.AddSingleton<IDocumentSearchService, DocumentSearchService>();
        return services;
    }
}
