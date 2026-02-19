module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/apps/web/src/lib/server/setup-store.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createSetupSession",
    ()=>createSetupSession,
    "getSetupSession",
    ()=>getSetupSession,
    "saveSetupSession",
    ()=>saveSetupSession
]);
const sessions = new Map();
function generateToken() {
    return crypto.randomUUID().replace(/-/g, '');
}
function buildWebhookData(input) {
    const path = `/api/v1/webhooks/perfectpay/${input.sessionId}/${input.token}`;
    return {
        provider: 'perfectpay',
        path,
        url: `${input.requestOrigin}${path}`,
        token: input.token
    };
}
function createSetupSession(input) {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const token = generateToken();
    const session = {
        id,
        projectName: input.payload.projectName,
        state: 'created',
        createdAt: now,
        updatedAt: now,
        input: input.payload,
        webhook: buildWebhookData({
            requestOrigin: input.requestOrigin,
            sessionId: id,
            token
        }),
        checks: {
            gatewayCredentials: 'pending',
            metaToken: 'pending',
            landingProbe: 'pending'
        },
        issues: []
    };
    sessions.set(id, session);
    return session;
}
function getSetupSession(id) {
    return sessions.get(id) ?? null;
}
function saveSetupSession(session) {
    session.updatedAt = new Date().toISOString();
    sessions.set(session.id, session);
}
}),
"[project]/apps/web/src/lib/server/validation.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "runValidations",
    ()=>runValidations
]);
const GRAPH_BASE = process.env.META_GRAPH_API_BASE ?? 'https://graph.facebook.com/v21.0';
const PERFECTPAY_BASE = process.env.PERFECTPAY_API_BASE ?? 'https://app.perfectpay.com.br';
const PERFECTPAY_VALIDATE_PATH = process.env.PERFECTPAY_VALIDATE_PATH ?? '/api/v1/sales/get';
async function validateMetaToken(input) {
    const url = new URL(`${GRAPH_BASE}/${input.pixelId}`);
    url.searchParams.set('fields', 'id');
    url.searchParams.set('access_token', input.accessToken);
    try {
        const response = await fetch(url.toString(), {
            method: 'GET'
        });
        const data = await response.json().catch(()=>null);
        if (!response.ok) {
            return {
                ok: false,
                message: data?.error?.message ?? `Meta API retornou ${response.status}`
            };
        }
        return data?.id ? {
            ok: true
        } : {
            ok: false,
            message: 'Pixel nao encontrado.'
        };
    } catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : 'Erro de rede ao validar Meta.'
        };
    }
}
async function validatePerfectPay(input) {
    const endpoint = `${PERFECTPAY_BASE}${PERFECTPAY_VALIDATE_PATH}`;
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                Authorization: `Bearer ${input.apiKey}`
            },
            body: JSON.stringify({
                page: 1
            })
        });
        const data = await response.json().catch(()=>null);
        if (!response.ok) {
            return {
                ok: false,
                message: data?.error?.message ?? data?.message ?? `Perfect Pay retornou ${response.status}`
            };
        }
        return {
            ok: true
        };
    } catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : 'Erro de rede ao validar Perfect Pay.'
        };
    }
}
async function runValidations(session) {
    const issues = [];
    const perfectPayResult = await validatePerfectPay({
        apiKey: session.input.gateway.apiKey
    });
    const webhookOk = session.input.gateway.webhookSecret.trim().length >= 8;
    const gatewayOk = perfectPayResult.ok && webhookOk;
    const metaResult = await validateMetaToken({
        pixelId: session.input.meta.pixelId,
        accessToken: session.input.meta.accessToken
    });
    const landingOk = /^https?:\/\//.test(session.input.landingUrl);
    session.checks.gatewayCredentials = gatewayOk ? 'ok' : 'failed';
    session.checks.metaToken = metaResult.ok ? 'ok' : 'failed';
    session.checks.landingProbe = landingOk ? 'ok' : 'failed';
    if (!gatewayOk) {
        issues.push(`Falha na validacao de credenciais da Perfect Pay${perfectPayResult.message ? `: ${perfectPayResult.message}` : '.'}`);
    }
    if (!metaResult.ok) {
        issues.push(`Falha na validacao do token/pixel Meta${metaResult.message ? `: ${metaResult.message}` : '.'}`);
    }
    if (!landingOk) {
        issues.push('Falha no probe da URL da landing page.');
    }
    session.issues = issues;
    session.state = issues.length === 0 ? 'validated' : 'troubleshooting_required';
    return session;
}
}),
"[project]/apps/web/src/app/api/v1/setup/sessions/[id]/validate/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST,
    "runtime",
    ()=>runtime
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$server$2f$setup$2d$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/lib/server/setup-store.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$server$2f$validation$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/lib/server/validation.ts [app-route] (ecmascript)");
;
;
;
const runtime = 'nodejs';
async function POST(_request, context) {
    const { id } = await context.params;
    const session = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$server$2f$setup$2d$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSetupSession"])(id);
    if (!session) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            message: 'Setup session nao encontrada.'
        }, {
            status: 404
        });
    }
    const validated = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$server$2f$validation$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["runValidations"])(session);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$server$2f$setup$2d$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["saveSetupSession"])(validated);
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(validated);
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__f4830e9b._.js.map