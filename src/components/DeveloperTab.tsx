import React, { useState, useEffect } from 'react';
import { Code, Key, Terminal, Copy, Check, ExternalLink, Globe, RefreshCw, Play, Layout, Paintbrush, Shield, HelpCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface DeveloperTabProps {
  user: {
    uid: string;
    email: string;
    plan?: string;
  };
  lists: any[];
}

export default function DeveloperTab({ user, lists }: DeveloperTabProps) {
  // Config state for the Powered by Packer Tools Embed
  const [selectedListId, setSelectedListId] = useState<string>('all');
  const [embedTheme, setEmbedTheme] = useState<'dark' | 'light'>('dark');
  const [embedColor, setEmbedColor] = useState<string>('#ff4f3a');
  const [companyName, setCompanyName] = useState<string>('My Rental Shop');

  // Generated code outputs
  const [embedCode, setEmbedCode] = useState<string>('');
  const [scriptTag, setScriptTag] = useState<string>('');
  const [iframeUrl, setIframeUrl] = useState<string>('');
  const [copiedType, setCopiedType] = useState<'iframe' | 'script' | 'key' | 'endpoint' | null>(null);

  // API credentials simulation
  const [apiKey, setApiKey] = useState<string>('');
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);

  // Sandbox testing
  const [sandboxEndpoint, setSandboxEndpoint] = useState<'lists' | 'gear'>('lists');
  const [sandboxResponse, setSandboxResponse] = useState<any>(null);
  const [isSandboxRunning, setIsSandboxRunning] = useState(false);

  // Active code snippet tab inside sandbox API docs
  const [activeSnippetTab, setActiveSnippetTab] = useState<'javascript' | 'curl' | 'python' | 'react'>('javascript');

  useEffect(() => {
    // Load or generate a fake persistent-styled API key based on user credentials
    const cachedKey = localStorage.getItem(`packer_api_key_${user.uid}`);
    if (cachedKey) {
      setApiKey(cachedKey);
    } else {
      const generated = `pk_live_packer_${user.uid.slice(0, 8)}_${Math.random().toString(36).substring(2, 10)}`;
      localStorage.setItem(`packer_api_key_${user.uid}`, generated);
      setApiKey(generated);
    }
  }, [user.uid]);

  // Regenerate Embed Code when options change
  useEffect(() => {
    const fetchEmbed = async () => {
      try {
        const res = await fetch('/api/developer/embed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            theme: embedTheme,
            listId: selectedListId,
            primaryColor: embedColor,
            companyName: companyName
          })
        });
        const data = await res.json();
        if (data.status === 'success') {
          setEmbedCode(data.embedCode);
          setScriptTag(data.scriptTag);
          setIframeUrl(data.iframeUrl);
        }
      } catch (err) {
        console.error('Failed to update embed settings:', err);
      }
    };
    fetchEmbed();
  }, [selectedListId, embedTheme, embedColor, companyName]);

  const handleRegenerateKey = () => {
    setIsGeneratingKey(true);
    setTimeout(() => {
      const newKey = `pk_live_packer_${user.uid.slice(0, 8)}_${Math.random().toString(36).substring(2, 12)}`;
      localStorage.setItem(`packer_api_key_${user.uid}`, newKey);
      setApiKey(newKey);
      setIsGeneratingKey(false);
      toast.success('Successfully provisioned new production API credentials.');
    }, 850);
  };

  const handleCopy = (text: string, type: 'iframe' | 'script' | 'key' | 'endpoint') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    toast.success('Copied to clipboard successfully!');
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleRunSandbox = async () => {
    setIsSandboxRunning(true);
    setSandboxResponse(null);
    try {
      const endpoint = sandboxEndpoint === 'lists' ? '/api/developer/lists' : '/api/developer/gear';
      const res = await fetch(`${endpoint}?apiKey=${apiKey}`);
      const data = await res.json();
      setSandboxResponse(data);
      toast.success('Sandbox returned live server context.');
    } catch (err) {
      console.error(err);
      toast.error('Sandbox execution failure.');
    } finally {
      setIsSandboxRunning(false);
    }
  };

  // Build the snippet text
  const getCodeSnippet = () => {
    const host = window.location.origin;
    const endpointPath = sandboxEndpoint === 'lists' ? '/api/developer/lists' : '/api/developer/gear';
    const fullUrl = `${host}${endpointPath}`;

    switch (activeSnippetTab) {
      case 'curl':
        return `curl -X GET "${fullUrl}" \\\n  -H "Authorization: Bearer ${apiKey}" \\\n  -H "Content-Type: application/json"`;
      case 'javascript':
        return `// Query Packer Tools from your website domain\nfetch("${fullUrl}", {\n  method: "GET",\n  headers: {\n    "x-api-key": "${apiKey}",\n    "Content-Type": "application/json"\n  }\n})\n.then(res => res.json())\n.then(data => console.log("Packer Goods:", data))\n.catch(err => console.error("API Error:", err));`;
      case 'python':
        return `# Python Requests script\nimport requests\n\nurl = "${fullUrl}"\nheaders = {\n    "x-api-key": "${apiKey}",\n    "Content-Type": "application/json"\n}\n\nresponse = requests.get(url, headers=headers)\nprint(response.json())`;
      case 'react':
        return `import React, { useEffect, useState } from 'react';\n\nexport default function RentalDisplay() {\n  const [items, setItems] = useState([]);\n\n  useEffect(() => {\n    fetch("${fullUrl}", {\n      headers: { "x-api-key": "${apiKey}" }\n    })\n    .then(res => res.json())\n    .then(data => setItems(data.${sandboxEndpoint}))\n  }, []);\n\n  return (\n    <div>\n      {items.map(item => (\n        <p key={item.id}>{item.name} - $\{item.rentalPrice}/day</p>\n      ))}\n    </div>\n  );\n}`;
      default:
        return '';
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-300 text-left">
      {/* Header card introducing Packer developers network */}
      <div className="bg-neutral-900 text-white rounded-[2.5rem] p-8 sm:p-10 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/20 blur-[90px] -mr-20 -mt-20 rounded-full" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-emerald-500/10 blur-[80px] -ml-20 -mb-20 rounded-full" />

        <div className="relative space-y-4 max-w-3xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-primary border border-white/5 text-[9px] font-black uppercase tracking-widest leading-none">
            🚀 Packer Live Client Connection
          </span>
          <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight leading-none text-white leading-[1.05]">
            Integrate & Embed Your Rental Shop
          </h2>
          <p className="text-neutral-400 text-sm leading-relaxed max-w-2xl font-medium">
            Connect Packer Tools directly into your website. Embed our professional checkout rental store, synchronized booking logs, and barcode verification engines or build custom dashboards using our lightweight REST APIs.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column: Embed Configurator */}
        <div className="lg:col-span-2 space-y-8">
          {/* Widget builder card */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-8">
            <div className="border-b border-neutral-50 pb-4">
              <h3 className="text-xl font-bold flex items-center gap-2 text-neutral-900">
                <Layout className="text-primary" size={20} />
                <span>Powered by Packer Tools Rental Shop Embed Customizer</span>
              </h3>
              <p className="text-xs text-neutral-400">Configure parameters for a fully interactive iframe listing of your selected gear sets.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block">Choose Inventory/List Payload</label>
                <select
                  value={selectedListId}
                  onChange={(e) => setSelectedListId(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-primary text-xs font-semibold"
                >
                  <option value="all">Embed Entire Public Portfolio (All available gear)</option>
                  {lists.map((l: any) => (
                    <option key={l.id} value={l.id}>{l.name} ({l.status || 'Active'})</option>
                  ))}
                </select>
                <p className="text-[9px] text-neutral-400">Only items published with active rental pricing will display inside the embedded storefront.</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block">Local Rental Business Banner</label>
                <input
                  type="text"
                  placeholder="e.g. CineRentals NZ"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-primary text-xs font-semibold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block">Visual Theme Accent</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="theme"
                      checked={embedTheme === 'dark'}
                      onChange={() => setEmbedTheme('dark')}
                      className="accent-primary"
                    />
                    <span className="text-xs font-bold text-neutral-700">Ambient Dark (Recom.)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="theme"
                      checked={embedTheme === 'light'}
                      onChange={() => setEmbedTheme('light')}
                      className="accent-primary"
                    />
                    <span className="text-xs font-bold text-neutral-700">Clean Editorial Light</span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block flex items-center justify-between">
                  <span>Accent Theme Color Selection</span>
                  <span className="font-mono text-[9px] text-primary">{embedColor}</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={embedColor}
                    onChange={(e) => setEmbedColor(e.target.value)}
                    className="w-10 h-10 rounded-xl overflow-hidden border-0 cursor-pointer block shrink-0"
                  />
                  <input 
                    type="text"
                    value={embedColor}
                    onChange={(e) => setEmbedColor(e.target.value)}
                    className="flex-1 px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Embed preview code boxes */}
            <div className="space-y-6 pt-4 border-t border-neutral-100">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#ff4f3a] font-mono">1. Responsive HTML Iframe Snippet</span>
                  <button
                    onClick={() => handleCopy(embedCode, 'iframe')}
                    className="flex items-center gap-1.5 px-3 py-1 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-[9px] font-bold text-neutral-600 transition"
                  >
                    {copiedType === 'iframe' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    <span>{copiedType === 'iframe' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="relative">
                  <pre className="p-4 bg-neutral-900 text-white rounded-2xl text-[10px] sm:text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-normal border border-neutral-800">
                    {embedCode || 'Generating custom container markup...'}
                  </pre>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 font-mono">2. Lightweight CDN Integration Tag (SDK)</span>
                  <button
                    onClick={() => handleCopy(scriptTag, 'script')}
                    className="flex items-center gap-1.5 px-3 py-1 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-[9px] font-bold text-neutral-600 transition"
                  >
                    {copiedType === 'script' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    <span>{copiedType === 'script' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="relative">
                  <pre className="p-4 bg-neutral-900 text-white rounded-2xl text-[10px] sm:text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-normal border border-neutral-800">
                    {scriptTag || 'Generating script code...'}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Live Sandbox */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-8">
            <div className="border-b border-neutral-50 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2 text-neutral-900">
                  <Terminal className="text-primary animate-pulse" size={20} />
                  <span>Real Packer REST API Explorer & Interactive Sandbox</span>
                </h3>
                <p className="text-xs text-neutral-400">Trigger standard query fetches against the app container endpoint with live returned results.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 bg-neutral-100 p-1 rounded-xl">
                <button
                  onClick={() => setSandboxEndpoint('lists')}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                    sandboxEndpoint === 'lists' ? 'bg-white shadow text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  GET /lists
                </button>
                <button
                  onClick={() => setSandboxEndpoint('gear')}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                    sandboxEndpoint === 'gear' ? 'bg-white shadow text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  GET /gear
                </button>
              </div>
            </div>

            {/* Snippet language tabs */}
            <div className="space-y-4">
              <div className="flex border-b border-neutral-100">
                {(['javascript', 'curl', 'python', 'react'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveSnippetTab(tab)}
                    className={`px-4 py-2 border-b-2 font-bold text-[10px] uppercase tracking-wider text-neutral-600 transition ${
                      activeSnippetTab === tab ? 'border-primary text-neutral-950 font-black' : 'border-transparent text-neutral-400 hover:text-neutral-700'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="relative">
                <pre className="p-4 bg-neutral-900 text-neutral-100 rounded-2xl text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed border border-neutral-800">
                  {getCodeSnippet()}
                </pre>
                <button
                  onClick={() => handleCopy(getCodeSnippet(), 'endpoint')}
                  className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-xl transition text-white/50 hover:text-white"
                  title="Copy Implementation Code"
                >
                  {copiedType === 'endpoint' ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            {/* Execute Sandbox Request Panel */}
            <div className="bg-neutral-50 p-6 rounded-[1.5rem] border border-neutral-100 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-1 text-left">
                <span className="text-[8px] bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-bold uppercase font-mono">SANDBOX UPLINK</span>
                <p className="text-sm font-bold text-neutral-800 font-sans">Verify endpoint connection with active credentials</p>
                <p className="text-xs text-neutral-500 font-medium">Runs fetch on `GET /api/developer/{sandboxEndpoint}` relative to this container domain.</p>
              </div>
              <button
                onClick={handleRunSandbox}
                disabled={isSandboxRunning}
                className="flex items-center gap-2 px-6 py-3 bg-neutral-900 hover:bg-black text-white text-xs font-black uppercase tracking-widest rounded-xl transition shadow disabled:opacity-50"
              >
                {isSandboxRunning ? (
                  <RefreshCw size={14} className="animate-spin text-primary" />
                ) : (
                  <Play size={14} className="text-primary fill-current" />
                )}
                <span>{isSandboxRunning ? 'Connecting...' : 'Run Query Sandbox'}</span>
              </button>
            </div>

            {/* Sandbox Response Output */}
            {sandboxResponse && (
              <div className="space-y-2 animate-fadeIn">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#ff4f3a] block font-mono">Live HTTP Server Response:</span>
                <pre className="p-6 bg-neutral-950 text-emerald-400 rounded-2xl text-[11px] font-mono overflow-x-auto border border-neutral-900 leading-normal max-h-[350px] scrollbar-hide text-left">
                  {JSON.stringify(sandboxResponse, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: API credentials & developer specifications */}
        <div className="space-y-8">
          {/* Production Credentials Panel */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
            <div className="flex items-center gap-2">
              <Key className="text-primary animate-pulse" size={20} />
              <h3 className="font-bold text-lg text-neutral-950">API Authentication</h3>
            </div>
            <p className="text-xs text-neutral-500 leading-relaxed font-sans font-medium">
              Every request to Packer Dev engines must authorize using this confidential credential Bearer key proxy. Keep this protected.
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block">Live Private Secret Key</label>
                <div className="flex bg-neutral-50 rounded-xl overflow-hidden border border-neutral-200">
                  <input
                    type="password"
                    readOnly
                    value={apiKey}
                    className="flex-1 bg-transparent px-4 py-2.5 text-xs font-mono outline-none"
                  />
                  <button
                    onClick={() => handleCopy(apiKey, 'key')}
                    className="px-4 hover:bg-neutral-100 transition border-l border-neutral-100"
                    title="Copy Secret Key"
                  >
                    {copiedType === 'key' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-neutral-500" />}
                  </button>
                </div>
              </div>

              <button
                onClick={handleRegenerateKey}
                disabled={isGeneratingKey}
                className="w-full py-2.5 text-center text-xs font-black uppercase tracking-widest text-neutral-600 bg-neutral-50 border border-neutral-150 rounded-xl hover:bg-neutral-100 transition disabled:opacity-50"
              >
                {isGeneratingKey ? 'Rotating credentials...' : 'Rotate API Credentials'}
              </button>
            </div>
          </div>

          {/* Beta Program Self-Service Access Mode */}
          <div className="bg-purple-50 p-8 rounded-[2.5rem] border border-purple-150/70 space-y-6">
            <div className="flex items-center gap-2">
              <Sparkles className="text-purple-600 animate-pulse" size={20} />
              <h3 className="font-bold text-lg text-neutral-950">Beta Program Access</h3>
            </div>
            <p className="text-xs text-purple-950 leading-relaxed font-medium">
              Activate your platform-wide Beta Tester status to unlock the brand new <strong className="font-bold">🧪 Beta Bug Finder</strong> module and other experimental features directly on your dashboard.
            </p>

            <button
              onClick={async () => {
                try {
                  const currentStatus = !!(user as any).isBetaTester;
                  await updateDoc(doc(db, 'users', user.uid), {
                    isBetaTester: !currentStatus
                  });
                  toast.success(
                    !currentStatus 
                      ? "Beta status activated! Look for the '🧪 Beta Bug Finder' tab on your main dashboard." 
                      : "Beta status deactivated."
                  );
                } catch (err) {
                  console.error("Error toggling beta status:", err);
                  toast.error("Failed to update Beta program credentials.");
                }
              }}
              className={`w-full py-2.5 text-center text-xs font-black uppercase tracking-widest rounded-xl transition shadow-sm border ${
                (user as any).isBetaTester 
                  ? 'bg-purple-600 border-purple-600 text-white hover:bg-purple-700' 
                  : 'bg-white border-purple-200 text-purple-700 hover:bg-purple-50'
              }`}
            >
              {(user as any).isBetaTester ? 'Beta Access Active (Disable)' : 'Enable Beta Access'}
            </button>
          </div>

          {/* Guidelines & Documentation panel */}
          <div className="bg-neutral-50 p-8 rounded-[2.5rem] border border-neutral-100/70 space-y-6">
            <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
              <Shield size={16} className="text-emerald-500" />
              <span>Integrations Guidelines & Rules</span>
            </h3>

            <div className="space-y-4 text-xs text-neutral-600 font-sans leading-relaxed">
              <div className="space-y-1">
                <p className="font-bold text-neutral-800">● Core CORS Permissions</p>
                <p className="text-neutral-500">Packer Tools automatically allows standard connections from localhost domains & registered organizational websites for easy local prototyping.</p>
              </div>

              <div className="space-y-1">
                <p className="font-bold text-neutral-800">● Installs & Requirements</p>
                <p className="text-neutral-500">To embed checkout paying triggers, secure a fully functional Stripe checkout flow or establish verified rental accounts inside settings.</p>
              </div>

              <div className="space-y-1">
                <p className="font-bold text-neutral-800">● Rate limits & limits</p>
                <p className="text-neutral-500 font-medium">Your current {user.plan || 'Free'} accounts limits are capped at <strong className="font-bold text-neutral-800">10,000 queries per month</strong> with 5 burst RPS capacity.</p>
              </div>

              <div className="space-y-1">
                <p className="font-bold text-neutral-800">● Support & Slack logs</p>
                <p className="text-neutral-500">Need specific custom payloads or webhook integrations? Reach out inside Slack channels or consult our public API knowledge base documentation anytime.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
