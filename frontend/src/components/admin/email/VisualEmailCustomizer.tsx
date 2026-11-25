import React, { useState, useEffect, useRef } from 'react';
import emailTemplateApi from '../../../services/admin/email-templates';
import FieldTooltip from '../common/FieldTooltip';
import logo from '../../../assets/logo-5.png';
import {
  Paintbrush,
  FileText,
  Link2,
  Eye,
  Monitor,
  Smartphone,
  Sparkles,
  Plus,
  Trash2,
  Palette,
  Check,
  Code,
  Copy,
  RotateCcw,
  X,
  Loader2,
  CheckCheck,
} from 'lucide-react';

export interface VisualState {
  bodyBg: string;
  cardBg: string;
  headerBg: string;
  headingColor: string;
  textColor: string;
  footerBg: string;
  footerTextColor: string;
  footerContent: string;
  buttonEnabled: boolean;
  buttonText: string;
  buttonUrl: string;
  buttonBg: string;
  buttonTextColor: string;
  buttonRadius: string;
  buttonAlign: string;
  greeting: string;
  paragraphs: string[];
  infoBoxEnabled: boolean;
  infoBoxType: 'brand' | 'success' | 'warning' | 'danger';
  infoBoxTitle: string;
  infoBoxContent: string;
  footerNote: string;
  signoffGreeting: string;
  signoffName: string;
}

// Default starter visual state
export const DEFAULT_VISUAL_STATE: VisualState = {
  bodyBg: '#f1f5f9',
  cardBg: '#ffffff',
  headerBg: '#ffffff',
  headingColor: '#0f172a',
  textColor: '#334155',
  footerBg: '#f8fafc',
  footerTextColor: '#64748b',
  footerContent: 'You received this email because you registered on Boomerr.',

  buttonEnabled: true,
  buttonText: 'Add Your First Domain →',
  buttonUrl: "{{ config('app.url') }}/overview",
  buttonBg: '#2563eb',
  buttonTextColor: '#ffffff',
  buttonRadius: '8px',
  buttonAlign: 'center',

  greeting: "Hi {{ $firstName ?? 'there' }},",
  paragraphs: [
    "Welcome to Boomerr! We're excited to have you on board.",
    "To start monitoring your websites, SSL certificates, and APIs in real time, add your first domain below:",
  ],

  infoBoxEnabled: false,
  infoBoxType: 'brand',
  infoBoxTitle: 'Quick Tip',
  infoBoxContent: 'Our multi-region edge nodes continuously check uptime, latency, and SSL certificates.',

  footerNote: 'If you have any questions or need a hand, just reply directly to this email.',
  signoffGreeting: 'Best regards,',
  signoffName: 'The Boomerr Team',
};

// Preset Color Palettes
const COLOR_PRESETS = {
  bodyBg: [
    { label: 'Slate Gray', value: '#f1f5f9' },
    { label: 'Cloud White', value: '#f8fafc' },
    { label: 'Pure White', value: '#ffffff' },
    { label: 'Warm Cream', value: '#faf8f5' },
    { label: 'Dark Canvas', value: '#0b1120' },
  ],
  cardBg: [
    { label: 'White', value: '#ffffff' },
    { label: 'Off-White', value: '#fcfcfd' },
    { label: 'Light Slate', value: '#f8fafc' },
    { label: 'Night Card', value: '#1e293b' },
  ],
  headerBg: [
    { label: 'Pure White', value: '#ffffff' },
    { label: 'Cloud White', value: '#f8fafc' },
    { label: 'Slate Gray', value: '#f1f5f9' },
    { label: 'Brand Navy', value: '#080e1f' },
    { label: 'Midnight', value: '#0f172a' },
    { label: 'Obsidian Black', value: '#09090b' },
  ],
  footerBg: [
    { label: 'Light Slate', value: '#f8fafc' },
    { label: 'Cool Gray', value: '#f1f5f9' },
    { label: 'Pure White', value: '#ffffff' },
    { label: 'Dark Slate', value: '#0f172a' },
    { label: 'Deep Midnight', value: '#080e1f' },
    { label: 'Night Canvas', value: '#050505' },
  ],
  footerTextColor: [
    { label: 'Muted Slate', value: '#64748b' },
    { label: 'Slate Gray', value: '#94a3b8' },
    { label: 'Dark Charcoal', value: '#334155' },
    { label: 'Soft White', value: '#cbd5e1' },
    { label: 'Pure White', value: '#ffffff' },
  ],
  buttonBg: [
    { label: 'Modern Blue', value: '#2563eb' },
    { label: 'Vibrant Indigo', value: '#6366f1' },
    { label: 'Emerald Green', value: '#10b981' },
    { label: 'Amber Gold', value: '#f59e0b' },
    { label: 'Crimson Rose', value: '#f43f5e' },
    { label: 'Midnight Dark', value: '#0f172a' },
    { label: 'Violet Purple', value: '#8b5cf6' },
  ],
  buttonTextColor: [
    { label: 'Pure White', value: '#ffffff' },
    { label: 'Warm Yellow', value: '#fef08a' },
    { label: 'Dark Slate', value: '#0f172a' },
  ],
  headingColor: [
    { label: 'Pitch Slate', value: '#0f172a' },
    { label: 'Charcoal', value: '#1e293b' },
    { label: 'Deep Blue', value: '#1e3a8a' },
    { label: 'Pure White', value: '#ffffff' },
  ],
  textColor: [
    { label: 'Dark Gray', value: '#334155' },
    { label: 'Muted Slate', value: '#475569' },
    { label: 'Cool Charcoal', value: '#1e293b' },
    { label: 'Light Gray', value: '#94a3b8' },
  ],
};

const RADIUS_OPTIONS = [
  { label: 'Slight (4px)', value: '4px' },
  { label: 'Rounded (8px)', value: '8px' },
  { label: 'Smooth (12px)', value: '12px' },
  { label: 'Pill (9999px)', value: '9999px' },
  { label: 'Square (0px)', value: '0px' },
];

const INFO_BOX_STYLES: Record<string, { bg: string; border: string; text: string; title: string; label: string }> = {
  brand: { bg: '#eef2ff', border: '#c7d2fe', text: '#3730a3', title: '#1e1b4b', label: 'Brand Indigo' },
  success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', title: '#14532d', label: 'Success Green' },
  warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', title: '#78350f', label: 'Warning Amber' },
  danger: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', title: '#7f1d1d', label: 'Danger Red' },
};

/**
 * Smart Parser: Extracts visual configuration from raw Blade template HTML
 */
export function parseBladeToVisualState(html: string): VisualState {
  if (!html || typeof html !== 'string') {
    return { ...DEFAULT_VISUAL_STATE };
  }

  const state: VisualState = { ...DEFAULT_VISUAL_STATE, paragraphs: [] };

  // Parse layout colors
  const bodyBgMatch = html.match(/['"]bodyBg['"]\s*=>\s*['"]([^'"]+)['"]/i);
  if (bodyBgMatch) state.bodyBg = bodyBgMatch[1];

  const cardBgMatch = html.match(/['"]cardBg['"]\s*=>\s*['"]([^'"]+)['"]/i);
  if (cardBgMatch) state.cardBg = cardBgMatch[1];

  const headerBgMatch = html.match(/['"]headerBg['"]\s*=>\s*['"]([^'"]+)['"]/i);
  if (headerBgMatch) {
    state.headerBg = headerBgMatch[1] === '#080e1f' ? '#ffffff' : headerBgMatch[1];
  }

  const footerBgMatch = html.match(/['"]footerBg['"]\s*=>\s*['"]([^'"]+)['"]/i);
  if (footerBgMatch) state.footerBg = footerBgMatch[1];

  const footerTextColorMatch = html.match(/['"]footerTextColor['"]\s*=>\s*['"]([^'"]+)['"]/i);
  if (footerTextColorMatch) state.footerTextColor = footerTextColorMatch[1];

  const footerContentMatch = html.match(/['"]footerContent['"]\s*=>\s*['"]([^'"]*)['"]/i);
  if (footerContentMatch) {
    state.footerContent = footerContentMatch[1].replace(/\\'/g, "'");
  }

  // Parse greeting
  const greetingMatch =
    html.match(/<div class="email-greeting"[^>]*style="[^"]*color:\s*([^;"]+)[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
    html.match(/<div class="email-greeting"[^>]*>([\s\S]*?)<\/div>/i);
  if (greetingMatch) {
    if (greetingMatch.length === 3 && greetingMatch[1].startsWith('#')) {
      state.headingColor = greetingMatch[1];
      state.greeting = greetingMatch[2].trim();
    } else {
      state.greeting = greetingMatch[greetingMatch.length - 1].trim();
    }
  }

  // Parse Button
  const buttonRegex = /@component\(['"]emails\.components\.button['"](?:,\s*\[([\s\S]*?)\])?\)\s*([\s\S]*?)\s*@endcomponent/i;
  const buttonMatch = html.match(buttonRegex);
  if (buttonMatch) {
    state.buttonEnabled = true;
    state.buttonText = buttonMatch[2].trim();
    const props = buttonMatch[1] || '';

    const urlMatch = props.match(/['"]url['"]\s*=>\s*(?:['"]([^'"]+)['"]|([^,\n\]]+))/i);
    if (urlMatch) {
      const rawUrl = (urlMatch[1] || urlMatch[2] || '').trim();
      if (
        (rawUrl.startsWith("'") && rawUrl.endsWith("'")) ||
        (rawUrl.startsWith('"') && rawUrl.endsWith('"'))
      ) {
        state.buttonUrl = rawUrl.slice(1, -1);
      } else {
        state.buttonUrl = rawUrl;
      }
    }

    const bgMatch = props.match(/['"]bg['"]\s*=>\s*['"]([^'"]+)['"]/i);
    if (bgMatch) state.buttonBg = bgMatch[1];

    const colorMatch = props.match(/['"]color['"]\s*=>\s*['"]([^'"]+)['"]/i);
    if (colorMatch) state.buttonTextColor = colorMatch[1];

    const radiusMatch = props.match(/['"]radius['"]\s*=>\s*['"]([^'"]+)['"]/i);
    if (radiusMatch) state.buttonRadius = radiusMatch[1];

    const alignMatch = props.match(/['"]align['"]\s*=>\s*['"]([^'"]+)['"]/i);
    if (alignMatch) state.buttonAlign = alignMatch[1];
  } else {
    // Check fallback <a> button
    const aButtonMatch = html.match(/<a\s+[^>]*class="button"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    if (aButtonMatch) {
      state.buttonEnabled = true;
      state.buttonUrl = aButtonMatch[1];
      state.buttonText = aButtonMatch[2].trim();
    } else {
      state.buttonEnabled = false;
    }
  }

  // Parse Info Box
  const infoBoxRegex = /@component\(['"]emails\.components\.info-box['"](?:,\s*\[([\s\S]*?)\])?\)\s*([\s\S]*?)\s*@endcomponent/i;
  const infoBoxMatch = html.match(infoBoxRegex);
  if (infoBoxMatch) {
    state.infoBoxEnabled = true;
    state.infoBoxContent = infoBoxMatch[2].trim();
    const props = infoBoxMatch[1] || '';
    const typeMatch = props.match(/['"]type['"]\s*=>\s*['"]([^'"]+)['"]/i);
    if (typeMatch) state.infoBoxType = (typeMatch[1] as any) || 'brand';
    const titleMatch = props.match(/['"]title['"]\s*=>\s*['"]([^'"]+)['"]/i);
    if (titleMatch) state.infoBoxTitle = titleMatch[1];
  } else {
    state.infoBoxEnabled = false;
  }

  // Parse Signoff
  const signoffMatch = html.match(/<div class="signoff"[^>]*>\s*([\s\S]*?)\s*(?:<br\s*\/?>)?\s*<div class="signoff-name"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i);
  if (signoffMatch) {
    state.signoffGreeting = signoffMatch[1].replace(/<br\s*\/?>/gi, '').trim();
    state.signoffName = signoffMatch[2].trim();
  }

  // Parse Paragraphs
  const pRegex = /<p(?: style="[^"]*color:\s*([^;"]+)[^"]*")?[^>]*>([\s\S]*?)<\/p>/gi;
  const foundParagraphs: string[] = [];
  let pMatch: RegExpExecArray | null;
  while ((pMatch = pRegex.exec(html)) !== null) {
    const pStyleColor = pMatch[1];
    const pContent = pMatch[2].trim();
    if (pStyleColor && pStyleColor.startsWith('#')) {
      state.textColor = pStyleColor;
    }
    if (
      pContent.toLowerCase().includes('reply') ||
      pContent.toLowerCase().includes('questions') ||
      pContent.toLowerCase().includes('need a hand') ||
      pContent.toLowerCase().includes('help')
    ) {
      state.footerNote = pContent;
    } else {
      foundParagraphs.push(pContent);
    }
  }

  if (foundParagraphs.length > 0) {
    state.paragraphs = foundParagraphs;
  } else {
    state.paragraphs = [
      "Welcome to Boomerr! We're excited to have you on board.",
      "Add your first domain to begin monitoring uptime and performance in real time:",
    ];
  }

  return state;
}

/**
 * Smart Serializer: Compiles visual state into standard, robust Blade markup
 */
export function generateBladeFromVisualState(state: VisualState): string {
  const {
    bodyBg,
    cardBg,
    headerBg,
    headingColor,
    textColor,
    footerBg,
    footerTextColor,
    footerContent,
    buttonBg,
    buttonTextColor,
    buttonRadius,
    buttonAlign,
    greeting,
    paragraphs,
    buttonEnabled,
    buttonText,
    buttonUrl,
    infoBoxEnabled,
    infoBoxType,
    infoBoxTitle,
    infoBoxContent,
    footerNote,
    signoffGreeting,
    signoffName,
  } = state;

  const paragraphsHtml = paragraphs
    .filter((p) => p && p.trim().length > 0)
    .map((p) => `<p style="color: ${textColor};">${p.trim()}</p>`)
    .join('\n\n');

  const infoBoxHtml =
    infoBoxEnabled && infoBoxContent
      ? `@component('emails.components.info-box', ['type' => '${infoBoxType || 'brand'}', 'title' => '${(infoBoxTitle || '').replace(/'/g, "\\'")}'])\n${infoBoxContent.trim()}\n@endcomponent\n\n`
      : '';

  let buttonPropsUrl = `'#'`;
  if (buttonUrl) {
    const trimmed = buttonUrl.trim();
    if (trimmed.startsWith('config(') || trimmed.startsWith('route(') || trimmed.startsWith('$')) {
      let fixedExpr = trimmed;
      const singleQuotes = (fixedExpr.match(/'/g) || []).length;
      if (singleQuotes % 2 !== 0) {
        fixedExpr += "'";
      }
      buttonPropsUrl = fixedExpr;
    } else {
      const cleanUrl = trimmed.replace(/^['"]+|['"]+$/g, '');
      buttonPropsUrl = `'${cleanUrl.replace(/'/g, "\\'")}'`;
    }
  }

  const buttonHtml =
    buttonEnabled && buttonText
      ? `@component('emails.components.button', [\n    'url' => ${buttonPropsUrl},\n    'align' => '${buttonAlign || 'center'}',\n    'bg' => '${buttonBg || '#2563eb'}',\n    'color' => '${buttonTextColor || '#ffffff'}',\n    'radius' => '${buttonRadius || '8px'}'\n])\n${buttonText.trim()}\n@endcomponent\n\n`
      : '';

  const footerNoteHtml =
    footerNote && footerNote.trim() ? `<p style="color: ${textColor};">${footerNote.trim()}</p>\n\n` : '';

  const signoffHtml = `<div class="signoff" style="color: ${textColor};">\n    ${signoffGreeting || 'Best regards,'}<br>\n    <div class="signoff-name" style="color: ${headingColor}; font-weight: 700;">${signoffName || 'The Boomerr Team'}</div>\n</div>`;

  return `@component('emails.components.layout', [
    'unsubscribeUrl' => $unsubscribeUrl ?? null,
    'bodyBg' => '${bodyBg || '#f1f5f9'}',
    'cardBg' => '${cardBg || '#ffffff'}',
    'headerBg' => '${headerBg || '#ffffff'}',
    'footerBg' => '${footerBg || '#f8fafc'}',
    'footerTextColor' => '${footerTextColor || '#64748b'}',
    'footerContent' => '${(footerContent || '').replace(/'/g, "\\'")}'
])

<div class="email-greeting" style="color: ${headingColor}; font-size: 18px; font-weight: 700; margin-bottom: 18px;">${greeting || "Hi {{ $firstName ?? 'there' }},"}</div>

${paragraphsHtml}

${infoBoxHtml}${buttonHtml}${footerNoteHtml}${signoffHtml}

@endcomponent`;
}

interface VisualEmailCustomizerProps {
  initialHtml: string;
  subject?: string;
  onSubjectChange?: (sub: string) => void;
  onChangeHtml?: (html: string) => void;
  onSaveDatabase?: (html: string) => Promise<any>;
  templateId?: string | number;
  variables?: string[];
}

export const VisualEmailCustomizer: React.FC<VisualEmailCustomizerProps> = ({
  initialHtml,
  subject = '',
  onSubjectChange,
  onChangeHtml,
  onSaveDatabase,
  templateId,
  variables = ['firstName', 'unsubscribeUrl'],
}) => {
  const [activeTab, setActiveTab] = useState<'content' | 'button' | 'colors'>('content');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [visual, setVisual] = useState<VisualState>(() => parseBladeToVisualState(initialHtml));
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [editedCode, setEditedCode] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [savingCode, setSavingCode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const codeTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync edited code when modal opens
  useEffect(() => {
    if (codeModalOpen) {
      setEditedCode(generateBladeFromVisualState(visual));
      setIsDirty(false);
      setSaveStatus(null);
      setTimeout(() => {
        if (codeTextareaRef.current) {
          codeTextareaRef.current.focus();
        }
      }, 120);
    }
  }, [codeModalOpen]);

  // Close code modal on ESC key
  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => {
      if (!codeModalOpen || e.key !== 'Escape') return;
      setCodeModalOpen(false);
    };
    document.addEventListener('keydown', keyHandler);
    return () => document.removeEventListener('keydown', keyHandler);
  }, [codeModalOpen]);

  // Handle Tab key indentation in editor
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = target.value;
      const newVal = val.substring(0, start) + '    ' + val.substring(end);
      setEditedCode(newVal);
      setIsDirty(true);
      setTimeout(() => {
        if (codeTextareaRef.current) {
          codeTextareaRef.current.selectionStart = codeTextareaRef.current.selectionEnd = start + 4;
        }
      }, 0);
    }
  };

  const handleResetCode = () => {
    setEditedCode(generateBladeFromVisualState(visual));
    setIsDirty(false);
    setSaveStatus(null);
  };

  const handleSaveAndApply = async () => {
    if (!editedCode.trim()) {
      setSaveStatus({ type: 'error', message: 'Blade code cannot be empty.' });
      return;
    }

    setSavingCode(true);
    setSaveStatus(null);
    try {
      const parsedVisual = parseBladeToVisualState(editedCode);
      setVisual(parsedVisual);

      if (onChangeHtml) {
        onChangeHtml(editedCode);
      }

      let dbUpdated = false;
      if (onSaveDatabase) {
        const res = await onSaveDatabase(editedCode);
        if (res === false || (res && res.success === false)) {
          setSavingCode(false);
          setSaveStatus({
            type: 'error',
            message: res?.message || 'Failed to update template in database.',
          });
          return;
        }
        dbUpdated = true;
      } else if (templateId) {
        const res = await emailTemplateApi.updateTemplate(templateId, { body_html: editedCode });
        if (!res.success) {
          setSavingCode(false);
          setSaveStatus({
            type: 'error',
            message: res.message || 'Failed to update template in database.',
          });
          return;
        }
        dbUpdated = true;
      }

      setIsDirty(false);
      setSaveStatus({
        type: 'success',
        message: dbUpdated
          ? 'Blade code saved & updated in database successfully!'
          : 'Preview & form updated! Save the template to persist.',
      });
      setTimeout(() => {
        setSaveStatus(null);
      }, 3500);
    } catch (err: any) {
      console.error('Error saving blade code:', err);
      setSaveStatus({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to save blade code to database.',
      });
    } finally {
      setSavingCode(false);
    }
  };

  const handleCopyCode = async () => {
    const code = editedCode || generateBladeFromVisualState(visual);
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      }
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error('Failed to copy code: ', err);
    }
  };

  // Focus tracking for variable insertion
  const lastActiveField = useRef<{ field: string; index: number }>({ field: 'greeting', index: 0 });

  useEffect(() => {
    if (initialHtml) {
      setVisual(parseBladeToVisualState(initialHtml));
    }
  }, [initialHtml]);

  const updateVisualField = (key: keyof VisualState, value: any) => {
    const updated = { ...visual, [key]: value };
    setVisual(updated);
    const compiledBlade = generateBladeFromVisualState(updated);
    if (onChangeHtml) {
      onChangeHtml(compiledBlade);
    }
  };

  const handleParagraphChange = (index: number, value: string) => {
    const nextParagraphs = [...visual.paragraphs];
    nextParagraphs[index] = value;
    updateVisualField('paragraphs', nextParagraphs);
  };

  const handleAddParagraph = () => {
    updateVisualField('paragraphs', [...visual.paragraphs, 'New message paragraph...']);
  };

  const handleRemoveParagraph = (index: number) => {
    const nextParagraphs = visual.paragraphs.filter((_, i) => i !== index);
    updateVisualField('paragraphs', nextParagraphs.length > 0 ? nextParagraphs : ['']);
  };

  const handleInsertVariable = (varName: string) => {
    const tag = `{{ $${varName} }}`;
    const { field, index } = lastActiveField.current;

    if (field === 'subject' && onSubjectChange) {
      onSubjectChange((subject || '') + ' ' + tag);
    } else if (field === 'greeting') {
      updateVisualField('greeting', (visual.greeting || '') + ' ' + tag);
    } else if (field === 'paragraph') {
      const currentText = visual.paragraphs[index] || '';
      handleParagraphChange(index, currentText + ' ' + tag);
    } else if (field === 'buttonText') {
      updateVisualField('buttonText', (visual.buttonText || '') + ' ' + tag);
    } else if (field === 'infoBox') {
      updateVisualField('infoBoxContent', (visual.infoBoxContent || '') + ' ' + tag);
    } else if (field === 'footerContent') {
      updateVisualField('footerContent', (visual.footerContent || '') + ' ' + tag);
    }
  };

  const renderPreviewHtml = (rawContent: string) => {
    if (!rawContent) return '';
    let processed = String(rawContent)
      .replace(/\{\{\s*\$firstName\s*\?\?\s*['"][^'"]*['"]\s*\}\}/g, 'Alex')
      .replace(/\{\{\s*\$firstName\s*\}\}/g, 'Alex')
      .replace(/\{\{\s*\$domain\[['"]name['"]\]\s*\}\}/g, 'mysite.com')
      .replace(/\{\{\s*\$domain\[['"]url['"]\]\s*\}\}/g, 'https://mysite.com')
      .replace(/\{\{\s*\$unsubscribeUrl\s*\}\}/g, '#')
      .replace(/\{\{\s*\$upgradeUrl\s*\}\}/g, '#')
      .replace(/\{\{\s*\$domainCount\s*\}\}/g, '5')
      .replace(/\{\{\s*\$limit\s*\}\}/g, '5')
      .replace(/\{\{\s*\$stats\[['"]uptime['"]\]\s*\}\}/g, '99.98%')
      .replace(/\{\{\s*\$daysLeft\s*\}\}/g, '3')
      .replace(/\{\{\s*\$discountPercent\s*\}\}/g, '20%')
      .replace(/\{\{\s*\$couponCode\s*\}\}/g, 'SAVE20')
      .replace(/\{\{\s*\$([a-zA-Z0-9_]+)\s*\}\}/g, 'Alex')
      .replace(/\{!!\s*\$([a-zA-Z0-9_]+)\s*!!\}/g, '');

    const hasHtmlTags = /<[a-z][\s\S]*>/i.test(processed);
    if (!hasHtmlTags) {
      processed = processed.replace(/\n/g, '<br />');
    }
    return processed;
  };

  return (
    <div className="space-y-6">
      {/* Variable Chips Bar */}
      <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-400 shrink-0" />
          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400 dark:text-slate-200 uppercase tracking-wider">
            <span>Available Variables:</span>
            <FieldTooltip
              title="Available Variables"
              content="Click any variable chip to insert its dynamic merge tag into your currently active input field."
            />
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {variables.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => handleInsertVariable(v)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
              title="Click to insert variable into currently active field"
            >
              <span>+</span>
              <span>{`{{ $${v} }}`}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main 2-Column Visual Builder Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Customization Controls */}
        <div className="xl:col-span-6 space-y-6">
          {/* Customizer Sub-Nav Tabs */}
          <div className="flex items-center gap-2 p-1.5 bg-white dark:bg-[#0a0a0a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab('content')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'content'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <FileText className="w-4 h-4" />
              <span>Content & Copy</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('button')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'button'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <Link2 className="w-4 h-4" />
              <span>CTA Button & Links</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('colors')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'colors'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <Paintbrush className="w-4 h-4" />
              <span>Colors & Layout</span>
            </button>
          </div>

          {/* TAB 1: Content & Copy */}
          {activeTab === 'content' && (
            <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-blue-400" />
                  Email Copy & Dynamic Text
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-400">
                  Customize the personalized greeting, message paragraphs, callout boxes, and sign-off signature.
                </p>
              </div>

              {/* Greeting */}
              <div>
                <label className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  <span className="flex items-center gap-1.5">
                    <span>Salutation / Greeting</span>
                    <FieldTooltip
                      title="Salutation / Greeting"
                      content="The greeting opened at the top of the email (e.g. 'Hi {{ $firstName ?? 'there' }},'). Supports Blade variables."
                    />
                  </span>
                  <span className="text-[10px] text-slate-600 dark:text-slate-400 dark:text-slate-400 font-mono">Top Heading</span>
                </label>
                <input
                  type="text"
                  value={visual.greeting}
                  onFocus={() => {
                    lastActiveField.current = { field: 'greeting', index: 0 };
                  }}
                  onChange={(e) => updateVisualField('greeting', e.target.value)}
                  className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="e.g. Hi {{ $firstName ?? 'there' }},"
                />
              </div>

              {/* Message Paragraphs */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
                    <span>Message Body Paragraphs</span>
                    <FieldTooltip
                      title="Body Paragraphs"
                      content="The main message body. Add multiple paragraphs to structure your story and explanations cleanly."
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleAddParagraph}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Paragraph</span>
                  </button>
                </div>

                {visual.paragraphs.map((p, idx) => (
                  <div key={idx} className="relative group">
                    <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 mb-1 px-1">
                      <span>Paragraph {idx + 1}</span>
                      {visual.paragraphs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveParagraph(idx)}
                          className="text-red-400 hover:text-red-300 text-[11px] flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                    <textarea
                      rows={3}
                      value={p}
                      onFocus={() => {
                        lastActiveField.current = { field: 'paragraph', index: idx };
                      }}
                      onChange={(e) => handleParagraphChange(idx, e.target.value)}
                      className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="Write your email paragraph copy here..."
                    />
                  </div>
                ))}
              </div>

              {/* Callout / Info Box */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white uppercase">
                      <span>Highlighted Callout Box</span>
                      <FieldTooltip
                        title="Highlighted Callout Box"
                        content="Display an eye-catching callout banner (Tips, Alerts, Success notifications, or Warnings) inside your email."
                      />
                    </span>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 dark:text-slate-400">
                      Display an accented tip, warning, or alert box inside the email
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visual.infoBoxEnabled}
                      onChange={(e) => updateVisualField('infoBoxEnabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {visual.infoBoxEnabled && (
                  <div className="p-4 rounded-xl bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-400 uppercase mb-1">
                          Box Style
                        </label>
                        <select
                          value={visual.infoBoxType}
                          onChange={(e) => updateVisualField('infoBoxType', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                        >
                          <option value="brand">Brand Indigo</option>
                          <option value="success">Success Green</option>
                          <option value="warning">Warning Amber</option>
                          <option value="danger">Danger Red</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-400 uppercase mb-1">
                          Box Header Title
                        </label>
                        <input
                          type="text"
                          value={visual.infoBoxTitle}
                          onChange={(e) => updateVisualField('infoBoxTitle', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                          placeholder="e.g. Quick Tip"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-400 uppercase mb-1">
                        Box Content
                      </label>
                      <textarea
                        rows={3}
                        value={visual.infoBoxContent}
                        onFocus={() => {
                          lastActiveField.current = { field: 'infoBox', index: 0 };
                        }}
                        onChange={(e) => updateVisualField('infoBoxContent', e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                        placeholder="Info box details..."
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Sign-off & Footer Note */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
                  <span>Sign-off & Footer Note</span>
                  <FieldTooltip
                    title="Sign-off & Footer Note"
                    content="Help text above the sign-off, closing greeting, and team signature displayed at the bottom of the email."
                  />
                </label>
                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 dark:text-slate-400 mb-1">Footer Help Note</label>
                  <input
                    type="text"
                    value={visual.footerNote}
                    onChange={(e) => updateVisualField('footerNote', e.target.value)}
                    className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                    placeholder="e.g. If you have any questions or need a hand, just reply directly to this email."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 dark:text-slate-400 mb-1">Closing Greeting</label>
                    <input
                      type="text"
                      value={visual.signoffGreeting}
                      onChange={(e) => updateVisualField('signoffGreeting', e.target.value)}
                      className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                      placeholder="e.g. Best regards,"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 dark:text-slate-400 mb-1">Sender / Team Name</label>
                    <input
                      type="text"
                      value={visual.signoffName}
                      onChange={(e) => updateVisualField('signoffName', e.target.value)}
                      className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                      placeholder="e.g. The Boomerr Team"
                    />
                  </div>
                </div>

                {/* Email Footer Content / Disclaimer */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
                      <span>Email Footer Content / Disclaimer</span>
                      <FieldTooltip
                        title="Footer Content"
                        content="The text message displayed in the bottom footer area of the email (e.g. why the recipient received the email, copyright, or contact disclaimer). Supports dynamic merge variables."
                      />
                    </label>
                    <span className="text-[10px] text-slate-600 dark:text-slate-400 dark:text-slate-400 font-mono">Bottom Footer</span>
                  </div>
                  <textarea
                    rows={3}
                    value={visual.footerContent}
                    onFocus={() => {
                      lastActiveField.current = { field: 'footerContent', index: 0 };
                    }}
                    onChange={(e) => updateVisualField('footerContent', e.target.value)}
                    className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors leading-relaxed"
                    placeholder="e.g. You received this email because you registered on Boomerr."
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CTA Button & Links */}
          {activeTab === 'button' && (
            <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                    <Link2 className="w-4 h-4 text-blue-400" />
                    Call to Action (CTA) Button
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-400">
                    Configure the prominent link button directing users to take action.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visual.buttonEnabled}
                    onChange={(e) => updateVisualField('buttonEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {visual.buttonEnabled ? (
                <div className="space-y-4">
                  {/* Button Text */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                      <span>Button Label / Text</span>
                      <FieldTooltip
                        title="Button Label"
                        content="The text rendered inside the button (e.g., 'Add Your First Domain →', 'Verify My Email', 'Upgrade Plan')."
                      />
                    </label>
                    <input
                      type="text"
                      value={visual.buttonText}
                      onFocus={() => {
                        lastActiveField.current = { field: 'buttonText', index: 0 };
                      }}
                      onChange={(e) => updateVisualField('buttonText', e.target.value)}
                      className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="e.g. Add Your First Domain →"
                    />
                  </div>

                  {/* Button Destination URL */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                      <span>Target URL / Dynamic Link</span>
                      <FieldTooltip
                        title="Target URL"
                        content="The destination link URL. You can enter an absolute URL (e.g., https://yourdomain.com/overview) or a Blade expression (e.g., config('app.url') or $upgradeUrl)."
                      />
                    </label>
                    <input
                      type="text"
                      value={visual.buttonUrl}
                      onChange={(e) => updateVisualField('buttonUrl', e.target.value)}
                      className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="{{ config('app.url') }}/overview or $upgradeUrl"
                    />
                  </div>

                  {/* Alignment & Border Radius */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                        <span>Alignment</span>
                        <FieldTooltip
                          title="Alignment"
                          content="Horizontal alignment of the button within the email container (Center, Left, or Right)."
                        />
                      </label>
                      <select
                        value={visual.buttonAlign}
                        onChange={(e) => updateVisualField('buttonAlign', e.target.value)}
                        className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white"
                      >
                        <option value="center">Center</option>
                        <option value="left">Left Aligned</option>
                        <option value="right">Right Aligned</option>
                      </select>
                    </div>

                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                        <span>Corner Radius</span>
                        <FieldTooltip
                          title="Corner Radius"
                          content="Corner curvature of the button (Square, Slight, Rounded, Smooth, or Pill)."
                        />
                      </label>
                      <select
                        value={visual.buttonRadius}
                        onChange={(e) => updateVisualField('buttonRadius', e.target.value)}
                        className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white"
                      >
                        {RADIUS_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Button Colors Palette */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
                      <span>Button Background Color</span>
                      <FieldTooltip
                        title="Button Background Color"
                        content="Select a preset brand color or enter a custom hex color code for your CTA button."
                      />
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {COLOR_PRESETS.buttonBg.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => updateVisualField('buttonBg', c.value)}
                          className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all ${visual.buttonBg === c.value
                            ? 'ring-2 ring-blue-500 scale-110 border-white'
                            : 'border-slate-300 dark:border-slate-700 hover:scale-105'
                            }`}
                          style={{ backgroundColor: c.value }}
                          title={c.label}
                        >
                          {visual.buttonBg === c.value && (
                            <Check
                              className={`w-4 h-4 ${c.value === '#ffffff' ? 'text-slate-900' : 'text-slate-900 dark:text-white'
                                }`}
                            />
                          )}
                        </button>
                      ))}
                      <input
                        type="color"
                        value={visual.buttonBg}
                        onChange={(e) => updateVisualField('buttonBg', e.target.value)}
                        className="w-8 h-8 rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer bg-transparent"
                        title="Custom Color"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-600 dark:text-slate-400 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  CTA Button is currently disabled. Toggle the switch above to include a button.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Colors & Layout */}
          {activeTab === 'colors' && (
            <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                  <Palette className="w-4 h-4 text-blue-400" />
                  Color Scheme & Branding
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-400">
                  Configure the header banner, background canvas, card colors, and typography hues.
                </p>
              </div>

              {/* Header Background */}
              <div className="space-y-2">
                <label className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
                  <span className="flex items-center gap-1.5">
                    <span>Header Banner Color</span>
                    <FieldTooltip
                      title="Header Banner Color"
                      content="The color of the top header block containing the Boomerr brand logo. Defaults to Pure White (#ffffff)."
                    />
                  </span>
                  <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 dark:text-slate-400">{visual.headerBg}</span>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {COLOR_PRESETS.headerBg.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => updateVisualField('headerBg', c.value)}
                      className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all ${visual.headerBg === c.value
                        ? 'ring-2 ring-blue-500 scale-110 border-white'
                        : 'border-slate-300 dark:border-slate-700 hover:scale-105'
                        }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    >
                      {visual.headerBg === c.value && (
                        <Check className={`w-4 h-4 ${['#ffffff', '#f8fafc', '#f1f5f9'].includes(c.value.toLowerCase()) ? 'text-slate-900' : 'text-white'}`} />
                      )}
                    </button>
                  ))}
                  <input
                    type="color"
                    value={visual.headerBg}
                    onChange={(e) => updateVisualField('headerBg', e.target.value)}
                    className="w-8 h-8 rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer bg-transparent"
                    title="Custom Color"
                  />
                </div>
              </div>

              {/* Card & Outer Background */}
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-2">
                    <span>Email Outer Canvas</span>
                    <FieldTooltip
                      title="Canvas Background"
                      content="The backdrop background color surrounding the email card on desktop mail clients."
                    />
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={visual.bodyBg}
                      onChange={(e) => updateVisualField('bodyBg', e.target.value)}
                      className="w-8 h-8 rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={visual.bodyBg}
                      onChange={(e) => updateVisualField('bodyBg', e.target.value)}
                      className="w-24 bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-2">
                    <span>Card Background</span>
                    <FieldTooltip
                      title="Card Background"
                      content="The background color of the inner email content card container."
                    />
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={visual.cardBg}
                      onChange={(e) => updateVisualField('cardBg', e.target.value)}
                      className="w-8 h-8 rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={visual.cardBg}
                      onChange={(e) => updateVisualField('cardBg', e.target.value)}
                      className="w-24 bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Typography Colors */}
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-2">
                    <span>Heading / Greeting Color</span>
                    <FieldTooltip
                      title="Heading Color"
                      content="Color applied to the opening greeting line and sign-off sender title."
                    />
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={visual.headingColor}
                      onChange={(e) => updateVisualField('headingColor', e.target.value)}
                      className="w-8 h-8 rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={visual.headingColor}
                      onChange={(e) => updateVisualField('headingColor', e.target.value)}
                      className="w-24 bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-2">
                    <span>Body Text Color</span>
                    <FieldTooltip
                      title="Body Text Color"
                      content="Text color applied to standard message paragraphs and footer notes."
                    />
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={visual.textColor}
                      onChange={(e) => updateVisualField('textColor', e.target.value)}
                      className="w-8 h-8 rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={visual.textColor}
                      onChange={(e) => updateVisualField('textColor', e.target.value)}
                      className="w-24 bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Footer Background & Text Color */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <span>Footer Background & Text Colors</span>
                    <FieldTooltip
                      title="Footer Styling"
                      content="Configure the background color and text color of the bottom email footer area."
                    />
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 dark:text-slate-400">
                    Customize the background color and typography color of the bottom legal disclaimer and unsubscribe section.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Footer Background */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-2">
                      <span>Footer Background</span>
                      <FieldTooltip
                        title="Footer Background"
                        content="Background color of the bottom email footer container."
                      />
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={visual.footerBg}
                        onChange={(e) => updateVisualField('footerBg', e.target.value)}
                        className="w-8 h-8 rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={visual.footerBg}
                        onChange={(e) => updateVisualField('footerBg', e.target.value)}
                        className="w-24 bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs font-mono text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {COLOR_PRESETS.footerBg.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => updateVisualField('footerBg', c.value)}
                          className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${visual.footerBg === c.value
                            ? 'ring-2 ring-blue-500 scale-105 border-white'
                            : 'border-slate-300 dark:border-slate-700 hover:scale-105'
                            }`}
                          style={{ backgroundColor: c.value }}
                          title={c.label}
                        >
                          {visual.footerBg === c.value && (
                            <Check
                              className={`w-3 h-3 ${c.value === '#ffffff' || c.value === '#f8fafc' || c.value === '#f1f5f9'
                                ? 'text-slate-900'
                                : 'text-slate-900 dark:text-white'
                                }`}
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Footer Text Color */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-2">
                      <span>Footer Text Color</span>
                      <FieldTooltip
                        title="Footer Text Color"
                        content="Text color of the bottom email footer message and notes."
                      />
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={visual.footerTextColor}
                        onChange={(e) => updateVisualField('footerTextColor', e.target.value)}
                        className="w-8 h-8 rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={visual.footerTextColor}
                        onChange={(e) => updateVisualField('footerTextColor', e.target.value)}
                        className="w-24 bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs font-mono text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {COLOR_PRESETS.footerTextColor.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => updateVisualField('footerTextColor', c.value)}
                          className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${visual.footerTextColor === c.value
                            ? 'ring-2 ring-blue-500 scale-105 border-white'
                            : 'border-slate-300 dark:border-slate-700 hover:scale-105'
                            }`}
                          style={{ backgroundColor: c.value }}
                          title={c.label}
                        >
                          {visual.footerTextColor === c.value && (
                            <Check
                              className={`w-3 h-3 ${c.value === '#ffffff' || c.value === '#cbd5e1'
                                ? 'text-slate-900'
                                : 'text-slate-900 dark:text-white'
                                }`}
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer Content shortcut */}
                <div className="pt-2">
                  <label className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    <span className="flex items-center gap-1.5">
                      <span>Footer Content / Disclaimer</span>
                      <FieldTooltip
                        title="Footer Content"
                        content="Edit the text displayed in the bottom footer area."
                      />
                    </span>
                  </label>
                  <textarea
                    rows={2}
                    value={visual.footerContent}
                    onFocus={() => {
                      lastActiveField.current = { field: 'footerContent', index: 0 };
                    }}
                    onChange={(e) => updateVisualField('footerContent', e.target.value)}
                    className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors leading-relaxed"
                    placeholder="e.g. You received this email because you registered on Boomerr."
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Responsive Visual Preview (6 cols) */}
        <div className="xl:col-span-6 space-y-4 sticky top-6">
          {/* Preview Toolbar */}
          <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-slate-200 dark:border-slate-800 p-3 shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Live Dynamic Preview
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Device Toggle */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDevice('desktop')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${device === 'desktop'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  title="Desktop viewport (600px)"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Desktop</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDevice('mobile')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${device === 'mobile'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  title="Mobile viewport (360px)"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile</span>
                </button>
              </div>

              {/* View Raw Blade Code Modal Button */}
              <button
                type="button"
                onClick={() => setCodeModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
                title="View and edit generated Blade template source"
              >
                <Code className="w-3.5 h-3.5 text-blue-400" />
                <span>Blade Code</span>
              </button>
            </div>
          </div>

          {/* Email Canvas Preview Viewport */}
          <div
            className="email-preview-canvas p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex justify-center transition-all overflow-x-auto min-h-[520px]"
            style={{ backgroundColor: visual.bodyBg }}
          >
            <div
              className={`rounded-2xl shadow-xl overflow-hidden transition-all flex flex-col ${device === 'mobile' ? 'w-[360px]' : 'w-full max-w-[560px]'
                }`}
              style={{ backgroundColor: visual.cardBg }}
            >
              {/* Email Header with Logo */}
              <div
                className="px-8 py-5 text-center flex flex-col items-center justify-center border-b border-slate-100"
                style={{ backgroundColor: visual.headerBg }}
              >
                <div className="flex items-center gap-2">
                  <img src={logo} alt="Boomerr" className="w-10 h-10 object-contain" />
                  <span
                    className="font-bold text-2xl tracking-tight"
                    style={{
                      color: ['#ffffff', '#f8fafc', '#f1f5f9'].includes(visual.headerBg.toLowerCase())
                        ? '#0f172a'
                        : '#ffffff',
                    }}
                  >
                    Boomerr
                  </span>
                </div>
              </div>

              {/* Email Content Body */}
              <div className="p-8 space-y-4">
                {/* Greeting */}
                <div
                  className="font-bold text-lg"
                  style={{ color: visual.headingColor }}
                  dangerouslySetInnerHTML={{ __html: renderPreviewHtml(visual.greeting) }}
                />

                {/* Paragraphs */}
                {visual.paragraphs.map((p, idx) => (
                  <div
                    key={idx}
                    className="text-sm leading-relaxed"
                    style={{ color: visual.textColor }}
                    dangerouslySetInnerHTML={{ __html: renderPreviewHtml(p) }}
                  />
                ))}

                {/* Info Box */}
                {visual.infoBoxEnabled && (
                  <div
                    className="p-4 rounded-xl border text-sm"
                    style={{
                      backgroundColor: INFO_BOX_STYLES[visual.infoBoxType]?.bg || '#eef2ff',
                      borderColor: INFO_BOX_STYLES[visual.infoBoxType]?.border || '#c7d2fe',
                      color: INFO_BOX_STYLES[visual.infoBoxType]?.text || '#3730a3',
                    }}
                  >
                    {visual.infoBoxTitle && (
                      <div
                        className="font-bold text-xs uppercase tracking-wider mb-1"
                        style={{ color: INFO_BOX_STYLES[visual.infoBoxType]?.title || '#1e1b4b' }}
                      >
                        {visual.infoBoxTitle}
                      </div>
                    )}
                    <div
                      dangerouslySetInnerHTML={{
                        __html: renderPreviewHtml(visual.infoBoxContent),
                      }}
                    />
                  </div>
                )}

                {/* CTA Button */}
                {visual.buttonEnabled && visual.buttonText && (
                  <div
                    className="py-2"
                    style={{
                      textAlign: (visual.buttonAlign as any) || 'center',
                    }}
                  >
                    <span
                      className="inline-block font-semibold text-sm px-6 py-3 shadow-md cursor-pointer transition-transform hover:scale-105"
                      style={{
                        backgroundColor: visual.buttonBg,
                        color: visual.buttonTextColor,
                        borderRadius: visual.buttonRadius,
                      }}
                      dangerouslySetInnerHTML={{ __html: renderPreviewHtml(visual.buttonText) }}
                    />
                  </div>
                )}

                {/* Footer Note */}
                {visual.footerNote && (
                  <div
                    className="text-xs leading-relaxed pt-2"
                    style={{ color: visual.textColor }}
                    dangerouslySetInnerHTML={{ __html: renderPreviewHtml(visual.footerNote) }}
                  />
                )}

                {/* Sign-off */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/40 text-xs">
                  <div style={{ color: visual.textColor }}>{visual.signoffGreeting}</div>
                  <div className="font-bold mt-0.5" style={{ color: visual.headingColor }}>
                    {visual.signoffName}
                  </div>
                </div>
              </div>

              {/* Unsubscribe Footer */}
              <div
                className="px-8 py-4 border-t text-center text-[10px] leading-relaxed transition-colors"
                style={{
                  backgroundColor: visual.footerBg || '#f8fafc',
                  color: visual.footerTextColor || '#64748b',
                  borderColor: visual.footerBg === '#ffffff' || visual.footerBg === '#f8fafc' ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)',
                }}
              >
                <div
                  dangerouslySetInnerHTML={{
                    __html: renderPreviewHtml(visual.footerContent || 'You received this email because you registered on Boomerr.'),
                  }}
                />
                <div className="mt-1">
                  <span
                    className="underline cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
                    style={{ color: visual.footerTextColor || '#64748b' }}
                  >
                    Unsubscribe preferences
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Raw Blade Code Editor Modal */}
      {codeModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-3 sm:p-6">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setCodeModalOpen(false)}
          />
          <div className="relative z-10 bg-white dark:bg-[#0a0a0a] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col w-full max-w-4xl h-[88vh] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-[#0d0d0d]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Code className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Blade Template Source</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-400">
                    Directly inspect or edit the compiled Blade markup with live re-parsing.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
                >
                  {copiedCode ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetCode}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
                  title="Reset code from visual form controls"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCodeModalOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Editor Body */}
            <div className="flex-1 p-4 bg-slate-100 dark:bg-slate-950 overflow-hidden flex flex-col">
              <textarea
                ref={codeTextareaRef}
                value={editedCode}
                onChange={(e) => {
                  setEditedCode(e.target.value);
                  setIsDirty(true);
                }}
                onKeyDown={handleEditorKeyDown}
                className="w-full flex-1 p-4 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono text-xs rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-blue-500 leading-relaxed resize-none selection:bg-blue-600/30"
                spellCheck={false}
              />
            </div>

            {/* Status & Footer */}
            <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-[#0a0a0a]">
              <div>
                {saveStatus && (
                  <span
                    className={`text-xs font-medium flex items-center gap-1.5 ${saveStatus.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                  >
                    <span>{saveStatus.message}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCodeModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndApply}
                  disabled={savingCode}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingCode && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{savingCode ? 'Saving...' : 'Apply & Save Blade'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisualEmailCustomizer;
