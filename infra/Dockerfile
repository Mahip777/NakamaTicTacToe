FROM heroiclabs/nakama:3.22.0

# Copy your built modules (IMPORTANT)
COPY ../server/build /nakama/data/modules/build

# Expose port (not mandatory but good practice)
EXPOSE 7350

# Start Nakama (migration + run)
CMD ["/bin/sh", "-ecx", "\
/nakama/nakama migrate up --database.address $DATABASE_URL && \
exec /nakama/nakama \
--name nakama1 \
--database.address $DATABASE_URL \
--logger.level INFO \
--session.token_expiry_sec 7200 \
--runtime.path /nakama/data/modules/build \
--socket.server_port $PORT \
"]