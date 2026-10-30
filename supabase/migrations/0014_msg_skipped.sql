-- 0014: estado 'skipped' (bloqueado por allowlist) para la cola de mensajes.
alter type message_status add value if not exists 'skipped';
