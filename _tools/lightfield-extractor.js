const { chromium } = require('playwright');
const imapSimple = require('imap-simple');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', '_research', 'raw', 'lightfield-extraction');
const IMAP_CONFIG = {
  imap: {
    user: 'martin@elevay.dev',
    password: '1EjU7nGru2Ve',
    host: 'imappro.zoho.com',
    port: 993,
    tls: true,
    authTimeout: 10000,
    tlsOptions: { rejectUnauthorized: false }
  }
};
const LF_EMAIL = 'lf-signup@elevay.dev';
const LF_BASE = 'https://crm.lightfield.app';

const graphqlRequests = [];
const restRequests = [];
const allRequests = [];

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function saveJSON(filename, data) {
  fs.writeFileSync(path.join(OUTPUT_DIR, filename), JSON.stringify(data, null, 2));
  console.log(`[SAVED] ${filename}`);
}

function saveText(filename, text) {
  fs.writeFileSync(path.join(OUTPUT_DIR, filename), text);
  console.log(`[SAVED] ${filename}`);
}

async function getMagicLink(afterTimestamp) {
  console.log('[IMAP] Connecting to check for magic link...');
  const connection = await imapSimple.connect(IMAP_CONFIG);
  await connection.openBox('INBOX');

  for (let attempt = 0; attempt < 40; attempt++) {
    // Search ALL recent emails — catch-all means no TO filter works
    const sinceDate = new Date(Date.now() - 600000); // last 10 min
    const searchCriteria = [['SINCE', sinceDate.toISOString().split('T')[0]]];
    const fetchOptions = { bodies: ['HEADER', ''], markSeen: false };
    const messages = await connection.search(searchCriteria, fetchOptions);

    console.log(`[IMAP] Attempt ${attempt + 1}/40 - found ${messages.length} recent emails`);

    // Sort by UID descending (most recent first)
    messages.sort((a, b) => (b.attributes?.uid || 0) - (a.attributes?.uid || 0));

    for (const msg of messages.slice(0, 10)) {
      const headerPart = msg.parts.find(p => p.which === 'HEADER');
      const bodyPart = msg.parts.find(p => p.which === '');

      const from = headerPart?.body?.from?.[0] || '';
      const subject = headerPart?.body?.subject?.[0] || '';
      const to = headerPart?.body?.to?.[0] || '';

      console.log(`[IMAP]   → FROM: ${from} | SUBJ: ${subject} | TO: ${to}`);

      // Check if this is from Lightfield/Stytch
      const isRelevant = [from, subject, to].some(s =>
        /lightfield|stytch|magic|log.?in|sign.?in|verify/i.test(s)
      );

      if (!isRelevant && !to.includes('lf-signup')) continue;

      const rawBody = bodyPart?.body || '';
      let parsed;
      try {
        parsed = await simpleParser(rawBody);
      } catch(e) {
        continue;
      }
      const html = parsed.html || parsed.textAsHtml || '';
      const text = parsed.text || '';

      // Look for ANY link from lightfield.app or stytch
      const patterns = [
        /href="(https:\/\/[^"]*lightfield[^"]*)"/gi,
        /href="(https:\/\/[^"]*stytch[^"]*)"/gi,
        /(https:\/\/[^\s"<]*lightfield[^\s"<]*)/gi,
        /(https:\/\/[^\s"<]*stytch[^\s"<]*)/gi,
      ];

      for (const pattern of patterns) {
        const matches = [...(html + '\n' + text).matchAll(pattern)];
        for (const m of matches) {
          const link = m[1];
          // Skip static assets, images, unsubscribe
          if (/\.(png|jpg|css|ico)|unsubscribe|privacy|terms/i.test(link)) continue;
          console.log(`[IMAP] Found link: ${link.substring(0, 100)}...`);
          connection.end();
          return link;
        }
      }
    }

    await new Promise(r => setTimeout(r, 3000));
  }

  connection.end();
  throw new Error('Magic link not found after 120s');
}

async function setupNetworkCapture(page) {
  page.on('request', req => {
    const url = req.url();
    const postData = req.postData();
    allRequests.push({ url, method: req.method(), postData: postData ? postData.substring(0, 500) : null });

    if (postData && (url.includes('graphql') || url.includes('gql'))) {
      try {
        const body = JSON.parse(postData);
        graphqlRequests.push({
          url,
          operationName: body.operationName || body[0]?.operationName || 'unknown',
          query: body.query || body[0]?.query || null,
          variables: body.variables || body[0]?.variables || null
        });
      } catch (e) {
        graphqlRequests.push({ url, raw: postData.substring(0, 1000) });
      }
    }

    if (url.includes('/api/') && !url.includes('_next')) {
      restRequests.push({ url, method: req.method(), postData: postData ? postData.substring(0, 500) : null });
    }
  });

  page.on('response', async res => {
    const url = res.url();
    if (url.includes('graphql') || url.includes('gql')) {
      try {
        const body = await res.json();
        const existing = graphqlRequests.find(r => r.url === url && !r.response);
        if (existing) existing.response = JSON.stringify(body).substring(0, 2000);
      } catch (e) {}
    }
  });
}

async function tryGraphQLIntrospection(page) {
  console.log('\n[INTROSPECTION] Attempting GraphQL schema introspection...');

  const endpoints = [
    `${LF_BASE}/graphql`,
    `${LF_BASE}/api/graphql`,
    'https://api.lightfield.app/graphql',
    'https://api.lightfield.app/v1/graphql',
  ];

  const introspectionQuery = `
    query IntrospectionQuery {
      __schema {
        queryType { name }
        mutationType { name }
        subscriptionType { name }
        types {
          kind name description
          fields(includeDeprecated: true) {
            name description
            args { name description type { ...TypeRef } defaultValue }
            type { ...TypeRef }
            isDeprecated deprecationReason
          }
          inputFields { name description type { ...TypeRef } defaultValue }
          interfaces { ...TypeRef }
          enumValues(includeDeprecated: true) { name description isDeprecated deprecationReason }
          possibleTypes { ...TypeRef }
        }
        directives { name description locations args { name description type { ...TypeRef } defaultValue } }
      }
    }
    fragment TypeRef on __Type {
      kind name
      ofType { kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name } } } } } } }
    }
  `;

  // First: try to find the actual endpoint from captured requests
  const gqlEndpoints = [...new Set(graphqlRequests.map(r => r.url))];
  if (gqlEndpoints.length > 0) {
    console.log(`[INTROSPECTION] Found GraphQL endpoints from traffic: ${gqlEndpoints.join(', ')}`);
    endpoints.unshift(...gqlEndpoints);
  }

  // Try from page context (has cookies)
  for (const endpoint of [...new Set(endpoints)]) {
    console.log(`[INTROSPECTION] Trying ${endpoint}...`);
    try {
      const result = await page.evaluate(async ({ url, query }) => {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ query })
        });
        if (!resp.ok) return { status: resp.status, error: await resp.text().catch(() => 'no body') };
        return { status: resp.status, data: await resp.json() };
      }, { url: endpoint, query: introspectionQuery });

      if (result.data?.__schema || result.data?.data?.__schema) {
        console.log(`[INTROSPECTION] SUCCESS at ${endpoint}!`);
        saveJSON('graphql-introspection-full.json', result.data);

        const schema = result.data.__schema || result.data.data.__schema;
        const types = schema.types.filter(t => !t.name.startsWith('__'));
        const summary = types.map(t => ({
          name: t.name,
          kind: t.kind,
          fields: t.fields?.map(f => `${f.name}: ${formatType(f.type)}`) || [],
          enumValues: t.enumValues?.map(e => e.name) || []
        }));
        saveJSON('graphql-schema-summary.json', summary);
        return true;
      } else {
        console.log(`[INTROSPECTION] ${endpoint}: ${result.status} - ${JSON.stringify(result).substring(0, 200)}`);
      }
    } catch (e) {
      console.log(`[INTROSPECTION] ${endpoint}: ${e.message}`);
    }
  }

  console.log('[INTROSPECTION] Standard introspection failed - trying partial queries...');

  // Try partial introspection (some servers block full but allow partial)
  for (const endpoint of [...new Set(endpoints)].slice(0, 3)) {
    try {
      const result = await page.evaluate(async ({ url }) => {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ query: '{ __schema { queryType { name } mutationType { name } types { name kind } } }' })
        });
        if (!resp.ok) return null;
        return await resp.json();
      }, { url: endpoint });

      if (result?.data?.__schema) {
        console.log(`[INTROSPECTION] Partial success at ${endpoint}!`);
        saveJSON('graphql-partial-introspection.json', result.data);
        return true;
      }
    } catch (e) {}
  }

  return false;
}

function formatType(type) {
  if (!type) return 'unknown';
  if (type.kind === 'NON_NULL') return `${formatType(type.ofType)}!`;
  if (type.kind === 'LIST') return `[${formatType(type.ofType)}]`;
  return type.name || 'unknown';
}

async function navigateAllPages(page) {
  console.log('\n[NAV] Navigating all Lightfield pages...');

  const pages = [
    { name: 'up-next', url: '/crm/up-next' },
    { name: 'accounts', url: '/crm/accounts' },
    { name: 'contacts', url: '/crm/contacts' },
    { name: 'opportunities', url: '/crm/opportunities' },
    { name: 'tasks', url: '/crm/tasks' },
    { name: 'meetings', url: '/crm/meetings' },
    { name: 'notes', url: '/crm/notes' },
    { name: 'agent-new-chat', url: '/crm/agent' },
    { name: 'settings-profile', url: '/crm/settings/profile' },
    { name: 'settings-mail', url: '/crm/settings/mail-and-calendar' },
    { name: 'settings-knowledge', url: '/crm/settings/knowledge' },
    { name: 'settings-agent', url: '/crm/settings/agent' },
    { name: 'settings-api', url: '/crm/settings/api' },
    { name: 'settings-integrations', url: '/crm/settings/integrations' },
    { name: 'settings-members', url: '/crm/settings/members' },
    { name: 'settings-billing', url: '/crm/settings/billing' },
    { name: 'settings-skills', url: '/crm/settings/skills' },
    { name: 'settings-workspace', url: '/crm/settings/workspace' },
    { name: 'settings-notifications', url: '/crm/settings/notifications' },
    { name: 'settings-mcp', url: '/crm/settings/mcp' },
  ];

  const pageData = {};

  for (const pg of pages) {
    const fullUrl = `${LF_BASE}${pg.url}`;
    console.log(`[NAV] → ${pg.name} (${pg.url})`);
    try {
      await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);

      // Screenshot
      await page.screenshot({
        path: path.join(OUTPUT_DIR, `page-${pg.name}.png`),
        fullPage: true
      });

      // Save HTML
      const html = await page.content();
      saveText(`page-${pg.name}.html`, html);

      pageData[pg.name] = { url: pg.url, title: await page.title(), loaded: true };

      // On accounts page, try to click into first account for detail page
      if (pg.name === 'accounts') {
        try {
          const firstRow = await page.$('table tbody tr:first-child td:first-child a, [data-testid="account-row"]:first-child');
          if (firstRow) {
            await firstRow.click();
            await page.waitForTimeout(3000);
            await page.screenshot({ path: path.join(OUTPUT_DIR, 'page-account-detail.png'), fullPage: true });
            pageData['account-detail'] = { loaded: true };
            await page.goBack();
            await page.waitForTimeout(1000);
          }
        } catch (e) {
          console.log(`[NAV] Could not open account detail: ${e.message}`);
        }
      }

    } catch (e) {
      console.log(`[NAV] ${pg.name} failed: ${e.message}`);
      pageData[pg.name] = { url: pg.url, error: e.message };
    }
  }

  saveJSON('page-navigation-results.json', pageData);
  return pageData;
}

async function extractAPIKey(page) {
  console.log('\n[API] Trying to find/generate API key...');
  try {
    await page.goto(`${LF_BASE}/crm/settings/api`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'settings-api.png'), fullPage: true });

    const html = await page.content();
    saveText('settings-api.html', html);

    // Look for existing API key or generate button
    const apiKeyEl = await page.$('input[type="password"], input[readonly], code, [data-testid*="api-key"], pre');
    if (apiKeyEl) {
      const val = await apiKeyEl.inputValue().catch(() => apiKeyEl.textContent());
      if (val) {
        console.log(`[API] Found API key: ${val.substring(0, 10)}...`);
        saveText('api-key.txt', val);
        return val;
      }
    }

    // Try to find generate button
    const generateBtn = await page.$('button:has-text("Generate"), button:has-text("Create"), button:has-text("API")');
    if (generateBtn) {
      console.log('[API] Found generate button, clicking...');
      await generateBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'settings-api-after-generate.png'), fullPage: true });
    }

    return null;
  } catch (e) {
    console.log(`[API] Error: ${e.message}`);
    return null;
  }
}

async function testSkillsSystem(page) {
  console.log('\n[SKILLS] Testing Skills system...');
  try {
    // Navigate to skills settings
    await page.goto(`${LF_BASE}/crm/settings/skills`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'skills-page.png'), fullPage: true });

    const html = await page.content();
    saveText('skills-page.html', html);

    // Look for system skills list
    const skillElements = await page.$$('[data-testid*="skill"], .skill-card, [class*="skill"], li:has(button)');
    const skills = [];
    for (const el of skillElements) {
      const text = await el.textContent().catch(() => '');
      if (text.trim()) skills.push(text.trim().substring(0, 200));
    }
    if (skills.length > 0) {
      saveJSON('system-skills-list.json', skills);
      console.log(`[SKILLS] Found ${skills.length} skill elements`);
    }

    // Try to create a custom skill
    const createBtn = await page.$('button:has-text("Create"), button:has-text("New skill"), button:has-text("Add skill"), a:has-text("Create")');
    if (createBtn) {
      console.log('[SKILLS] Found create button, attempting to create a skill...');
      await createBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'skills-create-dialog.png'), fullPage: true });

      // Fill in skill details
      const nameInput = await page.$('input[placeholder*="name"], input[name="name"], input:first-of-type');
      if (nameInput) {
        await nameInput.fill('Enrich New Account');

        const descInput = await page.$('textarea, [contenteditable="true"], input[placeholder*="description"]');
        if (descInput) {
          await descInput.fill('When a new account is created, search the web for company info and update the account fields: industry, headcount, revenue, website, LinkedIn.');
        }

        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(OUTPUT_DIR, 'skills-create-filled.png'), fullPage: true });
        saveText('skills-create-form.html', await page.content());
      }
    }

  } catch (e) {
    console.log(`[SKILLS] Error: ${e.message}`);
  }
}

async function testKnowledgeLayer(page) {
  console.log('\n[KNOWLEDGE] Testing Knowledge Layer...');
  try {
    await page.goto(`${LF_BASE}/crm/settings/knowledge`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'knowledge-page.png'), fullPage: true });

    const html = await page.content();
    saveText('knowledge-page.html', html);

    // Look for existing knowledge entries
    const entries = await page.$$('[data-testid*="knowledge"], .knowledge-entry, [class*="knowledge"] li, tr');
    const knowledgeList = [];
    for (const el of entries) {
      const text = await el.textContent().catch(() => '');
      if (text.trim()) knowledgeList.push(text.trim().substring(0, 300));
    }
    if (knowledgeList.length > 0) {
      saveJSON('knowledge-entries.json', knowledgeList);
    }

    // Try to add knowledge
    const addBtn = await page.$('button:has-text("Add"), button:has-text("Create"), button:has-text("New")');
    if (addBtn) {
      console.log('[KNOWLEDGE] Found add button, creating knowledge entry...');
      await addBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'knowledge-add-dialog.png'), fullPage: true });

      const titleInput = await page.$('input[placeholder*="title"], input[placeholder*="name"], input:first-of-type');
      const contentInput = await page.$('textarea, [contenteditable="true"]');

      if (titleInput && contentInput) {
        await titleInput.fill('ICP Definition');
        await contentInput.fill(`Our Ideal Customer Profile:
- B2B SaaS companies, Series A to Series C
- 20-200 employees
- Using HubSpot, Salesforce, or Pipedrive as CRM
- Annual revenue $2M-$50M
- Industries: FinTech, HealthTech, DevTools, MarTech
- Located in US, UK, or France
- Pain points: manual data entry, poor CRM adoption, no signal-based prioritization
- Decision makers: VP Sales, CRO, Head of Revenue Ops, Founder/CEO`);

        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(OUTPUT_DIR, 'knowledge-add-filled.png'), fullPage: true });

        // Save but don't submit
        const saveBtn = await page.$('button:has-text("Save"), button:has-text("Create"), button[type="submit"]');
        if (saveBtn) {
          await saveBtn.click();
          await page.waitForTimeout(2000);
          await page.screenshot({ path: path.join(OUTPUT_DIR, 'knowledge-after-save.png'), fullPage: true });
          console.log('[KNOWLEDGE] Knowledge entry created');
        }
      }
    }

  } catch (e) {
    console.log(`[KNOWLEDGE] Error: ${e.message}`);
  }
}

async function testMCPSettings(page) {
  console.log('\n[MCP] Checking MCP server configuration...');
  try {
    await page.goto(`${LF_BASE}/crm/settings/mcp`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'mcp-settings.png'), fullPage: true });
    saveText('mcp-settings.html', await page.content());

    // Also try /crm/settings/integrations for MCP info
    await page.goto(`${LF_BASE}/crm/settings/integrations`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'integrations-settings.png'), fullPage: true });
    saveText('integrations-settings.html', await page.content());

  } catch (e) {
    console.log(`[MCP] Error: ${e.message}`);
  }
}

async function exportAllData(page) {
  console.log('\n[EXPORT] Exporting all data...');

  const entities = ['accounts', 'contacts', 'opportunities', 'tasks', 'meetings', 'notes'];

  for (const entity of entities) {
    try {
      await page.goto(`${LF_BASE}/crm/${entity}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);

      // Look for export button
      const exportBtn = await page.$('button:has-text("Export"), [aria-label*="export"], button:has-text("Import/Export")');
      if (exportBtn) {
        console.log(`[EXPORT] Found export for ${entity}, clicking...`);
        await exportBtn.click();
        await page.waitForTimeout(1000);

        // Look for CSV/Export option in dropdown
        const csvOption = await page.$('button:has-text("CSV"), a:has-text("CSV"), [role="menuitem"]:has-text("Export"), button:has-text("Export")');
        if (csvOption) {
          await csvOption.click();
          await page.waitForTimeout(3000);
          console.log(`[EXPORT] Triggered ${entity} CSV export`);
        }
      }

      // Alternative: use chat to export
    } catch (e) {
      console.log(`[EXPORT] ${entity} export error: ${e.message}`);
    }
  }
}

async function testChatWithKnowledge(page) {
  console.log('\n[CHAT] Testing chat with Knowledge context...');
  try {
    await page.goto(`${LF_BASE}/crm/agent`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Test 1: Query that should use ICP Knowledge
    const chatInput = await page.$('textarea, input[placeholder*="Ask"], [contenteditable="true"]');
    if (chatInput) {
      const queries = [
        'Based on my ICP, which of my current accounts is the best fit? Explain your reasoning.',
        'Run the "Find Next Best Action" skill for Meridian Labs',
        'List all available skills you can run'
      ];

      for (let i = 0; i < queries.length; i++) {
        console.log(`[CHAT] Query ${i + 1}: ${queries[i].substring(0, 60)}...`);
        await chatInput.fill(queries[i]);

        const sendBtn = await page.$('button[aria-label*="send"], button:has-text("Send"), button[type="submit"]');
        if (sendBtn) {
          await sendBtn.click();

          // Wait for response (spinner → checkmark)
          await page.waitForTimeout(20000);
          await page.screenshot({ path: path.join(OUTPUT_DIR, `chat-test-${i + 1}.png`), fullPage: true });

          // Extract response text
          const messages = await page.$$('[data-testid*="message"], .message, [class*="message"]');
          const lastMsg = messages[messages.length - 1];
          if (lastMsg) {
            const text = await lastMsg.textContent().catch(() => '');
            saveText(`chat-response-${i + 1}.txt`, text);
          }

          // Start new chat for next query
          if (i < queries.length - 1) {
            await page.goto(`${LF_BASE}/crm/agent`, { waitUntil: 'networkidle', timeout: 15000 });
            await page.waitForTimeout(2000);
          }
        }
      }
    }
  } catch (e) {
    console.log(`[CHAT] Error: ${e.message}`);
  }
}

async function main() {
  console.log('=== LIGHTFIELD EXTRACTION SCRIPT ===');
  console.log(`Started: ${new Date().toISOString()}`);

  // Try to use Edge's user data dir for existing sessions
  const edgeUserData = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'User Data');
  const chromeUserData = path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data');

  let browser, context;

  // Try launching with existing Chrome/Edge profile for stored cookies
  for (const [name, dataDir] of [['Edge', edgeUserData], ['Chrome', chromeUserData]]) {
    if (fs.existsSync(dataDir)) {
      console.log(`[AUTH] Trying ${name} profile at ${dataDir}...`);
      try {
        // Use a copy to avoid lock conflicts with running browser
        const tempProfile = path.join(OUTPUT_DIR, `${name.toLowerCase()}-profile`);
        browser = await chromium.launchPersistentContext(tempProfile, {
          headless: false,
          args: ['--start-maximized'],
          viewport: { width: 1920, height: 1080 },
          channel: name === 'Edge' ? 'msedge' : 'chrome',
        });
        context = browser;
        console.log(`[AUTH] Launched with ${name} channel`);
        break;
      } catch (e) {
        console.log(`[AUTH] ${name} launch failed: ${e.message.substring(0, 100)}`);
      }
    }
  }

  // Fallback to standard Chromium
  if (!browser) {
    console.log('[AUTH] Falling back to standard Chromium');
    browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    });
  }
  // For persistent context, pages() exists; for normal context, use newPage()
  const page = context.pages ? (context.pages()[0] || await context.newPage()) : await context.newPage();

  // Set up network capture
  await setupNetworkCapture(page);

  // STEP 1: Login — open browser and wait for manual auth
  console.log('\n[AUTH] Starting login flow...');
  console.log('[AUTH] ============================================');
  console.log('[AUTH] PLEASE LOG IN MANUALLY in the browser window');
  console.log('[AUTH] Use "Continue with Google" or magic link');
  console.log('[AUTH] Waiting up to 5 minutes for authentication...');
  console.log('[AUTH] ============================================');

  await page.goto(`${LF_BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  // Wait for navigation away from login page (max 8 min)
  let authenticated = false;
  for (let i = 0; i < 240; i++) {
    const url = page.url();
    if (!url.includes('/login') && !url.includes('/signup') && url.includes('lightfield')) {
      console.log(`[AUTH] Authenticated! Current URL: ${url}`);
      authenticated = true;
      break;
    }
    if (i % 10 === 0 && i > 0) {
      console.log(`[AUTH] Still waiting... (${i * 2}s elapsed)`);
    }
    await page.waitForTimeout(2000);
  }

  if (!authenticated) {
    console.log('[AUTH] ⚠ Timeout — no login detected after 8 minutes.');
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'login-timeout.png'), fullPage: true });
    await browser.close();
    process.exit(1);
  }

  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'post-login.png'), fullPage: true });

  // STEP 2: Navigate all pages (captures GraphQL traffic)
  await navigateAllPages(page);

  // Save captured traffic so far
  saveJSON('graphql-requests.json', graphqlRequests);
  saveJSON('rest-requests.json', restRequests);
  saveJSON('all-requests.json', allRequests.slice(0, 500));

  // STEP 3: GraphQL introspection
  await tryGraphQLIntrospection(page);

  // STEP 4: Extract/generate API key
  const apiKey = await extractAPIKey(page);

  // STEP 5: Skills system
  await testSkillsSystem(page);

  // STEP 6: Knowledge Layer
  await testKnowledgeLayer(page);

  // STEP 7: MCP settings
  await testMCPSettings(page);

  // STEP 8: Chat with Knowledge
  await testChatWithKnowledge(page);

  // STEP 9: Export all data
  await exportAllData(page);

  // Final: save all captured traffic
  saveJSON('graphql-requests-final.json', graphqlRequests);
  saveJSON('rest-requests-final.json', restRequests);

  // Summary
  const summary = {
    timestamp: new Date().toISOString(),
    totalRequests: allRequests.length,
    graphqlOperations: [...new Set(graphqlRequests.map(r => r.operationName))],
    restEndpoints: [...new Set(restRequests.map(r => `${r.method} ${r.url}`))],
    pagesVisited: Object.keys(await page.evaluate(() => performance.getEntries().filter(e => e.entryType === 'navigation').map(e => e.name))),
    screenshotCount: fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.png')).length,
    apiKeyFound: !!apiKey
  };
  saveJSON('extraction-summary.json', summary);

  console.log('\n=== EXTRACTION COMPLETE ===');
  console.log(`GraphQL operations captured: ${summary.graphqlOperations.length}`);
  console.log(`REST endpoints captured: ${summary.restEndpoints.length}`);
  console.log(`Screenshots taken: ${summary.screenshotCount}`);
  console.log(`Files saved to: ${OUTPUT_DIR}`);

  await browser.close();
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
