'use client';

import { useState, useCallback, useRef } from 'react';
import CanvasBackground from '@/components/CanvasBackground';
import FloatingPortfolio from '@/components/FloatingPortfolio';

interface EstimateResult {
  totalHours: number;
  days: number;
  dailyRate: number;
  priceMin: number;
  priceMax: number;
  daysMin: number;
  daysMax: number;
  detectedComplexity?: string;
  breakdown: { category: string; hours: number }[];
  studioComparison: { priceMin: number; priceMax: number; daysMin: number; daysMax: number };
  recommendations: string[];
}

interface ClarificationQuestion {
  id: string;
  question: string;
  options: string[];
  priority: 'high' | 'medium' | 'low';
}

const PROJECT_TYPES = [
  { value: 'landing', label: 'Лендинг / Визитка', icon: '🌐' },
  { value: 'corporate', label: 'Корпоративный сайт', icon: '🏢' },
  { value: 'ecommerce', label: 'Интернет-магазин', icon: '🛒' },
  { value: 'webapp', label: 'Веб-приложение (SaaS)', icon: '💻' },
  { value: 'social', label: 'Соцсеть / Платформа', icon: '🌍' },
  { value: 'game', label: 'Игровая платформа', icon: '🎮' },
  { value: 'marketplace', label: 'Маркетплейс', icon: '🏪' },
  { value: 'mobile', label: 'Мобильное приложение', icon: '📱' },
  { value: 'telegram', label: 'Telegram бот', icon: '🤖' },
  { value: 'crm', label: 'CRM / Админ-панель', icon: '📊' },
  { value: 'api', label: 'API / Backend', icon: '⚙️' },
  { value: 'custom', label: 'Своё / Другое', icon: '✨' },
];

const FEATURE_PRESETS = [
  'Авторизация / Личный кабинет',
  'Оплата онлайн',
  'Интеграция с CRM',
  'Email/SMS уведомления',
  'Админ-панель',
  'Поиск и фильтры',
  'Загрузка файлов',
  'Мультиязычность',
  'Аналитика / Графики',
  'Push-уведомления',
  'Экспорт в PDF/Excel',
  'Гео-сервисы / Карты',
];

const TECH_STACKS = [
  { value: 'any', label: 'Не знаю / Неважно', icon: '🤷' },
  { value: 'react', label: 'React / Next.js', icon: '⚛️' },
  { value: 'vue', label: 'Vue / Nuxt', icon: '💚' },
  { value: 'python', label: 'Python / Django', icon: '🐍' },
  { value: 'node', label: 'Node.js', icon: '🟢' },
  { value: 'php', label: 'PHP / Laravel', icon: '🐘' },
  { value: 'flutter', label: 'Flutter / React Native', icon: '📱' },
  { value: 'wordpress', label: 'WordPress', icon: '📝' },
];

const COMPLEXITY_LABELS: Record<string, string> = {
  'простой': 'Простой',
  'средний': 'Средний',
  'сложный': 'Сложный',
  'enterprise': 'Enterprise',
};

export default function Home() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Рассчитываем стоимость...');
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [fileContents, setFileContents] = useState<Map<string, string>>(new Map());
  const [dragOver, setDragOver] = useState(false);
  const [showCustomType, setShowCustomType] = useState(false);
  const [customFeatures, setCustomFeatures] = useState<string[]>([]);
  const [newCustomFeature, setNewCustomFeature] = useState('');
  const resultRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    projectType: '',
    projectTypeCustom: '',
    features: [] as string[],
    description: '',
    techStack: [] as string[],
    designNeeded: false,
    urgentDeadline: false,
  });

  // Analysis/clarification states
  const [analysisPhase, setAnalysisPhase] = useState<'idle' | 'analyzing' | 'questions' | 'pricing'>('idle');
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [analysisSummary, setAnalysisSummary] = useState('');

  const toggleFeature = (feature: string) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter(f => f !== feature)
        : [...prev.features, feature]
    }));
  };

  const toggleTech = (tech: string) => {
    if (tech === 'any') {
      setFormData(prev => ({ ...prev, techStack: ['any'] }));
      return;
    }
    setFormData(prev => ({
      ...prev,
      techStack: prev.techStack.includes('any')
        ? [tech]
        : prev.techStack.includes(tech)
          ? prev.techStack.filter(t => t !== tech)
          : [...prev.techStack.filter(t => t !== 'any'), tech]
    }));
  };

  const addCustomFeature = () => {
    if (newCustomFeature.trim() && customFeatures.length < 10) {
      setCustomFeatures(prev => [...prev, newCustomFeature.trim()]);
      setNewCustomFeature('');
    }
  };

  const removeCustomFeature = (index: number) => {
    setCustomFeatures(prev => prev.filter((_, i) => i !== index));
  };

  const handleProjectTypeSelect = (value: string) => {
    setFormData(prev => ({ ...prev, projectType: value }));
    setShowCustomType(value === 'custom');
  };

  const readFileContent = useCallback((file: File) => {
    if (uploadedFiles.length >= 10) return;
    const textTypes = ['.txt', '.md', '.json', '.csv', '.log', '.xml', '.yaml', '.yml'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    setUploadedFiles(prev => [...prev, file]);
    if (textTypes.includes(ext) && file.size < 1000000) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setFileContents(prev => {
          const next = new Map(prev);
          next.set(file.name, text || '');
          return next;
        });
      };
      reader.readAsText(file, 'utf-8');
    } else {
      setFileContents(prev => {
        const next = new Map(prev);
        next.set(file.name, '');
        return next;
      });
    }
  }, [uploadedFiles.length]);

  const removeFile = useCallback((index: number) => {
    setUploadedFiles(prev => {
      const removed = prev[index];
      setFileContents(fc => {
        const next = new Map(fc);
        if (removed) next.delete(removed.name);
        return next;
      });
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(f => readFileContent(f));
  }, [readFileContent]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(f => readFileContent(f));
    e.target.value = '';
  };

  const buildFullDescription = () => {
    return formData.description +
      Array.from(fileContents.entries()).map(([name, content]) =>
        content ? `\n\n===== ФАЙЛ: ${name} =====\n${content}` : `\n\n[Файл: ${name} — содержимое не прочитано]`
      ).join('');
  };

  const buildRequestBody = (phase: 'analyze' | 'price', clarifications?: Record<string, string>) => {
    return {
      phase,
      ...formData,
      customFeatures,
      description: buildFullDescription(),
      ...(clarifications ? { clarifications } : {}),
    };
  };

  // Phase 1: Submit form → AI analyzes → asks questions
  const handleSubmit = async () => {
    setAnalysisPhase('analyzing');
    setLoading(true);
    setLoadingText('AI анализирует ваш проект...');
    setError(null);
    setResult(null);

    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    try {
      const response = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRequestBody('analyze')),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Ошибка анализа');

      setAnalysisSummary(data.analysis || '');

      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        setAnswers({});
        setAnalysisPhase('questions');
      } else {
        // No questions — go straight to pricing
        await runPricing({});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка');
      setAnalysisPhase('idle');
    } finally {
      setLoading(false);
    }
  };

  // Phase 2: Send answers → AI calculates price
  const runPricing = async (finalAnswers: Record<string, string>) => {
    setAnalysisPhase('pricing');
    setLoading(true);
    setLoadingText('Рассчитываем точную стоимость...');

    try {
      const response = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRequestBody('price', finalAnswers)),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Ошибка при расчёте');

      setResult(data);
      setAnalysisPhase('idle');
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка');
      setAnalysisPhase('idle');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSubmit = () => {
    runPricing(answers);
  };

  const handleSkipQuestions = () => {
    runPricing({});
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const canProceed = () => {
    if (step === 1) {
      if (formData.projectType === 'custom') return formData.projectTypeCustom.length > 0;
      return formData.projectType !== '';
    }
    if (step === 2) return formData.description.length > 10 || uploadedFiles.length > 0;
    return true;
  };

  const resetAll = () => {
    setResult(null);
    setStep(1);
    setFormData({
      projectType: '', projectTypeCustom: '', features: [],
      description: '', techStack: [], designNeeded: false, urgentDeadline: false
    });
    setCustomFeatures([]);
    setUploadedFiles([]);
    setFileContents(new Map());
    setQuestions([]);
    setAnswers({});
    setAnalysisPhase('idle');
    setAnalysisSummary('');
    setError(null);
  };

  return (
    <div className="relative min-h-screen">
      {/* Canvas animated background */}
      <CanvasBackground />

      {/* Floating portfolio screenshots */}
      <FloatingPortfolio />

      {/* Main content */}
      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-3xl">
          {/* Header */}
          <div className="text-center mb-4 fade-in">
            <h1 className="text-4xl md:text-5xl font-extrabold mb-0 panel-title leading-tight">
              Сколько стоит проект?
            </h1>
          </div>

          {/* Step Indicator */}
          <div className="flex gap-2 mb-4">
            {[1, 2, 3].map(s => (
              <div key={s} className={`step-bar ${s <= step ? 'active' : ''}`} />
            ))}
          </div>

          {/* Glass Panel Form */}
          <div className="glass-card p-6 md:p-8">
            {/* Step 1: Project Type */}
            {step === 1 && (
              <div className="fade-in">
                <div className="text-xs uppercase tracking-wider mb-4"
                  style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'DM Sans, sans-serif' }}>
                  Тип проекта
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-3">
                  {PROJECT_TYPES.map(type => (
                    <button
                      key={type.value}
                      onClick={() => handleProjectTypeSelect(type.value)}
                      className={`type-card ${formData.projectType === type.value ? 'selected' : ''}`}
                    >
                      <span className="text-xl mb-1 block">{type.icon}</span>
                      <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>
                        {type.label}
                      </span>
                    </button>
                  ))}
                </div>

                {showCustomType && (
                  <div className="mt-4">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Опишите свой проект кратко..."
                      value={formData.projectTypeCustom}
                      onChange={e => setFormData(prev => ({ ...prev, projectTypeCustom: e.target.value }))}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Description & Features */}
            {step === 2 && (
              <div className="fade-in space-y-6">
                <div>
                  <div className="text-xs uppercase tracking-wider mb-2"
                    style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'DM Sans, sans-serif' }}>
                    Описание проекта
                  </div>
                  <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Это главное поле — чем подробнее описание, тем точнее расчёт
                  </p>
                  <textarea
                    className="form-input min-h-[140px] resize-none"
                    placeholder="Расскажите о проекте максимально подробно: какие страницы/экраны нужны, какой функционал, какие интеграции, примеры похожих проектов..."
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                  <div className="text-right text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {formData.description.length} символов
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-3 block" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    Загрузите ТЗ (до 10 файлов)
                  </label>
                  <div
                    className={`upload-area ${dragOver ? 'dragover' : ''}`}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleFileDrop}
                    onClick={() => document.getElementById('file-input')?.click()}
                  >
                    <input
                      id="file-input"
                      type="file"
                      multiple
                      className="hidden"
                      accept=".pdf,.doc,.docx,.txt,.md,.json,.yaml,.yml"
                      onChange={handleFileSelect}
                    />
                    <span className="text-4xl mb-3 block">📎</span>
                    <p style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {uploadedFiles.length > 0 ? 'Добавить ещё файлы...' : 'Перетащите файлы или нажмите для выбора'}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>TXT, MD, JSON, YAML — до 1 МБ каждый, максимум 10 файлов</p>
                  </div>

                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2 mt-3">
                      {uploadedFiles.map((file, i) => {
                        const content = fileContents.get(file.name);
                        const hasContent = content && content.length > 0;
                        return (
                          <div key={i} className="flex items-center gap-3 p-3 rounded-xl"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <span className="text-lg">📄</span>
                            <span className="flex-1 text-sm truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>{file.name}</span>
                            {hasContent ? (
                              <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                                style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}>
                                {content!.length.toLocaleString()} симв.
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}>
                                не читается
                              </span>
                            )}
                            <button onClick={() => removeFile(i)} style={{ color: '#ff6b6b' }} className="flex-shrink-0">✕</button>
                          </div>
                        );
                      })}
                      <div className="text-right text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        Всего прочитано: {Array.from(fileContents.values()).reduce((sum, c) => sum + c.length, 0).toLocaleString()} символов из {uploadedFiles.length} файл(ов)
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium mb-3 block" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    Функции из списка
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {FEATURE_PRESETS.map(feature => (
                      <button
                        key={feature}
                        onClick={() => toggleFeature(feature)}
                        className={`chip ${formData.features.includes(feature) ? 'active' : ''}`}
                      >
                        {feature}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-3 block" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    Добавить свои функции ({customFeatures.length}/10)
                  </label>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      className="form-input flex-1"
                      placeholder="Своя функция..."
                      maxLength={200}
                      value={newCustomFeature}
                      onChange={e => setNewCustomFeature(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addCustomFeature()}
                    />
                    <button
                      onClick={addCustomFeature}
                      disabled={!newCustomFeature.trim() || customFeatures.length >= 10}
                      className="px-5 py-2 rounded-full font-bold text-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{
                        background: 'linear-gradient(135deg, #0066ff, #38bdf8)',
                        color: 'white',
                      }}
                    >
                      +
                    </button>
                  </div>
                  <div className="text-right text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {newCustomFeature.length}/200
                  </div>
                  {customFeatures.length > 0 && (
                    <div className="space-y-2 mt-3">
                      {customFeatures.map((feature, i) => (
                        <div key={i} className="flex items-center gap-2 p-3 rounded-xl"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <span className="flex-1 text-sm">{feature}</span>
                          <button onClick={() => removeCustomFeature(i)} style={{ color: '#ff6b6b' }}>
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Tech & Options */}
            {step === 3 && (
              <div className="fade-in space-y-6">
                <div>
                  <div className="text-xs uppercase tracking-wider mb-4"
                    style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'DM Sans, sans-serif' }}>
                    Технологии и опции
                  </div>
                  <label className="text-sm font-medium mb-3 block" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    Стек технологий
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TECH_STACKS.map(tech => (
                      <button
                        key={tech.value}
                        onClick={() => toggleTech(tech.value)}
                        className={`chip ${formData.techStack.includes(tech.value) ? 'active' : ''}`}
                      >
                        <span className="mr-1">{tech.icon}</span>
                        {tech.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="form-checkbox"
                      checked={formData.designNeeded}
                      onChange={e => setFormData(prev => ({ ...prev, designNeeded: e.target.checked }))}
                    />
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>Нужен дизайн (UI/UX)</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="form-checkbox"
                      checked={formData.urgentDeadline}
                      onChange={e => setFormData(prev => ({ ...prev, urgentDeadline: e.target.checked }))}
                    />
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>Срочный проект (наценка за скорость)</span>
                  </label>
                </div>

                {/* Summary */}
                <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(56,189,248,0.12)' }}>
                  <h3 className="text-xs uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Итого:</h3>
                  <div className="text-sm space-y-1">
                    <div style={{ color: 'rgba(255,255,255,0.5)' }}>
                      Тип: <span style={{ color: 'white' }}>
                        {formData.projectType === 'custom'
                          ? formData.projectTypeCustom
                          : PROJECT_TYPES.find(t => t.value === formData.projectType)?.label}
                      </span>
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.5)' }}>
                      Сложность: <span style={{ color: 'rgba(56,189,248,0.8)' }}>AI определит автоматически</span>
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.5)' }}>
                      Описание: <span style={{ color: 'white' }}>
                        {formData.description.length > 50 ? formData.description.slice(0, 50) + '...' : formData.description || '—'}
                      </span>
                    </div>
                    {formData.features.length + customFeatures.length > 0 && (
                      <div style={{ color: 'rgba(255,255,255,0.5)' }}>
                        Функций: <span style={{ color: 'white' }}>{formData.features.length + customFeatures.length}</span>
                      </div>
                    )}
                    <div style={{ color: 'rgba(255,255,255,0.5)' }}>
                      Технологии: <span style={{ color: 'white' }}>
                        {formData.techStack.includes('any')
                          ? 'На усмотрение'
                          : formData.techStack.map(v => TECH_STACKS.find(t => t.value === v)?.label).join(', ') || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-5">
              {step > 1 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="px-6 py-3 rounded-full text-sm font-medium transition-all"
                  style={{
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.7)',
                    background: 'transparent',
                  }}
                  onMouseEnter={e => {
                    (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                  }}
                  onMouseLeave={e => {
                    (e.target as HTMLElement).style.background = 'transparent';
                  }}
                >
                  ← Назад
                </button>
              )}
              <div className="ml-auto">
                {step < 3 ? (
                  <button
                    onClick={() => setStep(step + 1)}
                    disabled={!canProceed()}
                    className="btn-primary"
                  >
                    Далее →
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="btn-primary pulse-glow"
                  >
                    {loading ? 'Анализ...' : 'Рассчитать стоимость'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Result area - scroll target */}
          <div ref={resultRef}>
          {/* Loading */}
          {loading && (
            <div className="mt-8 text-center fade-in">
              <div className="spinner mx-auto mb-4" />
              <p style={{ color: 'rgba(255,255,255,0.4)' }}>{loadingText}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-8 p-4 rounded-2xl fade-in"
              style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', color: '#ff6b6b' }}>
              {error}
            </div>
          )}

          {/* Clarifying Questions */}
          {analysisPhase === 'questions' && questions.length > 0 && (
            <div className="mt-8 glass-card p-6 md:p-8 fade-in">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: 'linear-gradient(135deg, #0066ff, #38bdf8)' }}>
                  ?
                </div>
                <div>
                  <h3 className="text-lg font-bold" style={{ color: 'white' }}>Уточняющие вопросы</h3>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    AI проанализировал ваш проект и хочет уточнить детали для точной оценки
                  </p>
                </div>
              </div>

              {analysisSummary && (
                <div className="mt-3 p-3 rounded-xl mb-5"
                  style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)' }}>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{analysisSummary}</p>
                </div>
              )}

              <div className="space-y-5">
                {questions.map((q) => (
                  <div key={q.id} className="space-y-2">
                    <div className="flex items-start gap-2">
                      {q.priority === 'high' && (
                        <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                          style={{ background: 'rgba(255,107,107,0.15)', color: '#ff6b6b' }}>важно</span>
                      )}
                      <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>
                        {q.question}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 pl-0">
                      {q.options.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => setAnswers(prev => ({ ...prev, [q.question]: opt }))}
                          className="px-4 py-2 rounded-full text-xs font-medium transition-all"
                          style={{
                            background: answers[q.question] === opt
                              ? 'linear-gradient(135deg, #0066ff, #38bdf8)'
                              : 'rgba(255,255,255,0.05)',
                            border: answers[q.question] === opt
                              ? '1px solid transparent'
                              : '1px solid rgba(255,255,255,0.12)',
                            color: answers[q.question] === opt ? 'white' : 'rgba(255,255,255,0.6)',
                          }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleAnswerSubmit}
                  className="btn-primary flex-1"
                >
                  Рассчитать стоимость
                </button>
                <button
                  onClick={handleSkipQuestions}
                  className="px-6 py-3 rounded-full text-sm font-medium transition-all"
                  style={{
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.5)',
                    background: 'transparent',
                  }}
                  onMouseEnter={e => {
                    (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                  }}
                  onMouseLeave={e => {
                    (e.target as HTMLElement).style.background = 'transparent';
                  }}
                >
                  Пропустить
                </button>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="mt-8 result-card fade-in">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                  style={{ background: 'linear-gradient(135deg, #0066ff, #38bdf8)' }}>
                  ✓
                </div>
                <div>
                  <h3 className="text-xl font-bold" style={{ color: 'white' }}>Оценка готова!</h3>
                  {result.detectedComplexity && (
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Определённая сложность: <span style={{ color: '#38bdf8' }}>{COMPLEXITY_LABELS[result.detectedComplexity] || result.detectedComplexity}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Price & Timeline */}
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Стоимость</div>
                  <div className="text-xl font-bold gradient-text">
                    {formatPrice(result.priceMin)} — {formatPrice(result.priceMax)}
                  </div>
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Сроки</div>
                  <div className="text-xl font-bold" style={{ color: 'white' }}>
                    {result.daysMin} — {result.daysMax} дней
                  </div>
                </div>
              </div>

              {/* Formula block */}
              <div className="p-4 rounded-xl mb-6" style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)' }}>
                <div className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Как рассчитана цена:</div>
                <div className="text-sm space-y-1" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  <div>{result.totalHours} часов работы ÷ 7 часов/день = <strong style={{ color: '#38bdf8' }}>{result.days} дней</strong></div>
                  <div>{result.days} дней × {(result.dailyRate || 5000).toLocaleString('ru-RU')} ₽/день = <strong className="gradient-text">{formatPrice(result.days * (result.dailyRate || 5000))}</strong></div>
                </div>
              </div>

              {/* Breakdown */}
              {result.breakdown && result.breakdown.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium mb-3 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>Модули проекта:</h4>
                  <div className="space-y-2">
                    {result.breakdown.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <span className="text-sm">{item.category}</span>
                        <span className="text-sm font-medium" style={{ color: '#38bdf8' }}>{item.hours}ч</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between p-3 rounded-xl"
                      style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)' }}>
                      <span className="text-sm font-medium" style={{ color: 'white' }}>Итого</span>
                      <span className="text-sm font-bold" style={{ color: '#38bdf8' }}>{result.totalHours}ч</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Studio comparison */}
              {result.studioComparison && (
                <div className="p-4 rounded-xl mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Для сравнения:</div>
                  <div className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    Студия разработки оценила бы этот проект в{' '}
                    <strong style={{ color: 'rgba(255,255,255,0.8)' }}>
                      {formatPrice(result.studioComparison.priceMin)} — {formatPrice(result.studioComparison.priceMax)}
                    </strong>{' '}
                    на срок <strong style={{ color: 'rgba(255,255,255,0.8)' }}>
                      {result.studioComparison.daysMin} — {result.studioComparison.daysMax} дней
                    </strong>.
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {result.recommendations && result.recommendations.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>Полезно знать:</h4>
                  <ul className="space-y-2">
                    {result.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        <span style={{ color: '#38bdf8' }}>→</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={resetAll}
                className="mt-6 w-full py-3 rounded-full text-sm font-medium transition-all"
                style={{
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.7)',
                  background: 'transparent',
                }}
                onMouseEnter={e => {
                  (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={e => {
                  (e.target as HTMLElement).style.background = 'transparent';
                }}
              >
                Новый расчёт
              </button>
            </div>
          )}
          </div>
        </div>
        <footer className="mt-16 text-center text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>
          <p>Калькулятор стоимости • {new Date().getFullYear()}</p>
        </footer>
      </main>
    </div>
  );
}
