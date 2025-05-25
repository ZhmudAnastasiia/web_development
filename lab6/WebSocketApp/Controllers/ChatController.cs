using Microsoft.AspNetCore.Mvc;
using System.Net.WebSockets;
using System.Text;
using System.Collections.Concurrent;
using System.Text.Json;

namespace ChatApi.Controllers;

[ApiController]
[Route("ws/chat")]
public class ChatWebSocketController : ControllerBase
{
    private static ConcurrentDictionary<string, WebSocket> _sockets = new();

    [HttpGet]
    public async Task Get(string username)
    {
        if (!HttpContext.WebSockets.IsWebSocketRequest || string.IsNullOrWhiteSpace(username))
        {
            HttpContext.Response.StatusCode = 400;
            return;
        }

        var socket = await HttpContext.WebSockets.AcceptWebSocketAsync();
        _sockets.TryAdd(username, socket);

        await BroadcastSystemMessage($"{username} приєднався до чату", "join");
        await BroadcastUsersList();

        var buffer = new byte[1024 * 4];

        while (socket.State == WebSocketState.Open)
        {
            var result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
            var message = Encoding.UTF8.GetString(buffer, 0, result.Count);

            if (message.StartsWith("/w "))
            {
                var parts = message.Split(' ', 3);
                if (parts.Length >= 3)
                {
                    var toUser = parts[1];
                    var privateMsg = parts[2];
                    if (_sockets.TryGetValue(toUser, out var receiver))
                    {
                        await SendMessageAsync(receiver, username, privateMsg, "private");
                        await SendMessageAsync(socket, username, privateMsg, "privateTo", toUser);
                    }
                    else
                    {
                        await SendSystemMessageAsync(socket, $"Користувача '{toUser}' не знайдено", "error");
                    }
                }
            }
            else
            {
                await BroadcastMessage(username, message, "public");
            }
        }

        _sockets.TryRemove(username, out _);
        await BroadcastSystemMessage($"{username} покинув чат", "leave");
        await BroadcastUsersList();
    }

    private static async Task BroadcastMessage(string username, string message, string type)
    {
        var payload = JsonSerializer.Serialize(new
        {
            username,
            message,
            type,
            timestamp = DateTime.UtcNow
        });

        await BroadcastRaw(payload);
    }

    private static async Task SendMessageAsync(WebSocket socket, string username, string message, string type, string? toUser = null)
    {
        if (socket.State == WebSocketState.Open)
        {
            var payload = JsonSerializer.Serialize(new
            {
                username,
                message,
                type,
                to = toUser,
                timestamp = DateTime.UtcNow
            });

            var bytes = Encoding.UTF8.GetBytes(payload);
            await socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
        }
    }

    private static async Task BroadcastSystemMessage(string message, string type)
    {
        var payload = JsonSerializer.Serialize(new
        {
            username = "System",
            message,
            type,
            timestamp = DateTime.UtcNow
        });

        await BroadcastRaw(payload);
    }

    private static async Task SendSystemMessageAsync(WebSocket socket, string message, string type)
    {
        if (socket.State == WebSocketState.Open)
        {
            var payload = JsonSerializer.Serialize(new
            {
                username = "System",
                message,
                type,
                timestamp = DateTime.UtcNow
            });

            var bytes = Encoding.UTF8.GetBytes(payload);
            await socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
        }
    }

    private static async Task BroadcastRaw(string payload)
    {
        var bytes = Encoding.UTF8.GetBytes(payload);
        foreach (var socket in _sockets.Values)
        {
            if (socket.State == WebSocketState.Open)
            {
                await socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
            }
        }
    }

    private static async Task BroadcastUsersList()
    {
        var usersJson = JsonSerializer.Serialize(_sockets.Keys);
        var message = $"__USERS__{usersJson}";
        var bytes = Encoding.UTF8.GetBytes(message);

        foreach (var socket in _sockets.Values)
        {
            if (socket.State == WebSocketState.Open)
            {
                await socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
            }
        }
    }
}
