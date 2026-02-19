export type MetaValidationResult = {
  ok: boolean;
  message?: string;
};

const GRAPH_BASE = process.env.META_GRAPH_API_BASE ?? 'https://graph.facebook.com/v21.0';

export async function validateMetaTokenRemote(input: {
  pixelId: string;
  accessToken: string;
}): Promise<MetaValidationResult> {
  const url = new URL(`${GRAPH_BASE}/${input.pixelId}`);
  url.searchParams.set('fields', 'id');
  url.searchParams.set('access_token', input.accessToken);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = (await response.json().catch(() => null)) as
      | { id?: string; error?: { message?: string } }
      | null;

    if (!response.ok) {
      return {
        ok: false,
        message: data?.error?.message ?? `Meta API retornou ${response.status}`
      };
    }

    if (!data?.id) {
      return {
        ok: false,
        message: 'Resposta do Meta sem id de pixel.'
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Falha de rede ao validar Meta.'
    };
  }
}
