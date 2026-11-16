# Pluggy (Meu Pluggy) setup

Open Finance sync uses the Pluggy REST API with `fetch` (no SDK).

## Environment variables

Copy from `.env.example` and fill in:

- `PLUGGY_API_CLIENT_ID`
- `PLUGGY_API_CLIENT_SECRET`

Optional helpers for local development (never commit real values):

- `PLUGGY_ITEM_NUBANK_PF`
- `PLUGGY_ITEM_NUBANK_PJ`
- `PLUGGY_ITEM_ITAU`

Values may be a bare item UUID or a Meu Pluggy dashboard URL that contains the UUID.

## Setup steps

1. Create a Meu Pluggy application and copy the client id and secret into `.env`.
2. In Meu Pluggy, connect the banks you care about and note each **item** id.
3. In the app, open **Conexões**, paste an item id, choose the entity, then map each Pluggy account to an existing app account or create a new one.
4. Use **Sincronizar agora**, review the preview (duplicates unchecked by default), and confirm.

## Limits of Meu Pluggy

- Meu Pluggy **cannot list items** through the API in a way that replaces pasting an item id. The app does not build an item picker.
- Meu Pluggy has **no webhooks** for this personal-use flow. Sync is manual (**Sincronizar agora**) only.
- Failed or expired connections surface a Portuguese status message and **do not** save a partial import.

## API surface used

- `POST https://api.pluggy.ai/auth` → API key
- `GET /items/{itemId}` → connection health
- `GET /accounts?itemId=`
- `GET /v2/transactions?accountId=&dateFrom=&dateTo=` with cursor pagination via `next`
