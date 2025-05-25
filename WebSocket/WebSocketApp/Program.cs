using ChatApi.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<ChatHandler>();
builder.Services.AddControllers();

var app = builder.Build();

app.UseWebSockets();
app.MapControllers();

app.MapGet("/users", (ChatHandler handler) =>
{
    return Results.Ok(handler.GetConnectedUsers());
});

app.Run();
