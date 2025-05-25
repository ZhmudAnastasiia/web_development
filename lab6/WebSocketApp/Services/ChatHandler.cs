using System.Net.WebSockets;
using System.Text;
using System.Collections.Concurrent;

namespace ChatApi.Services
{
    public class ChatHandler
    {
        private static ConcurrentDictionary<string, WebSocket> _users = new();

        public async Task HandleAsync(HttpContext context)
        {
            if (context.WebSockets.IsWebSocketRequest)
            {
                var username = context.Request.Query["username"];
                var socket = await context.WebSockets.AcceptWebSocketAsync();

                _users[username] = socket;

                await BroadcastAsync($"{username} приєднався до чату", "System");

                await ReceiveAsync(socket, async (message) =>
                {
                    if (message.StartsWith("/w ")) // Приватне повідомлення
                    {
                        var split = message.Split(' ', 3);
                        if (split.Length >= 3)
                        {
                            var targetUser = split[1];
                            var privateMessage = split[2];
                            if (_users.TryGetValue(targetUser, out var targetSocket))
                            {
                                await SendAsync($"{username} (приватно): {privateMessage}", targetSocket);
                            }
                        }
                    }
                    else
                    {
                        await BroadcastAsync($"{username}: {message}", username);
                    }
                });

                _users.TryRemove(username, out _);
                await BroadcastAsync($"{username} покинув чат", "System");
                await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closed", CancellationToken.None);
            }
            else
            {
                context.Response.StatusCode = 400;
            }
        }

        private async Task ReceiveAsync(WebSocket socket, Func<string, Task> handleMessage)
        {
            var buffer = new byte[1024 * 4];

            while (socket.State == WebSocketState.Open)
            {
                var result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);

                if (result.MessageType == WebSocketMessageType.Close)
                    break;

                var message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                await handleMessage(message);
            }
        }

        private async Task SendAsync(string message, WebSocket socket)
        {
            if (socket.State == WebSocketState.Open)
            {
                var buffer = Encoding.UTF8.GetBytes(message);
                await socket.SendAsync(new ArraySegment<byte>(buffer), WebSocketMessageType.Text, true, CancellationToken.None);
            }
        }

        private async Task BroadcastAsync(string message, string fromUser)
        {
            foreach (var userSocket in _users)
            {
                await SendAsync(message, userSocket.Value);
            }
        }

        public IEnumerable<string> GetConnectedUsers() => _users.Keys;
    }
}