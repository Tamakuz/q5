// dashboard/src/components/waku/WakuThumbnailStep.tsx
import React, { useState, useEffect } from 'react';
import type { WakuThumbnailConcept, WakuThumbnailResult, WakuUploadMetadata } from '../../electron-api';

const TEXT_MODELS = [
  { id: 'ag/gemini-3-flash-agent', name: 'ag/gemini-3-flash-agent (Default / Recommended)' },
  { id: 'cx/gpt-5.5', name: 'cx/gpt-5.5' },
  { id: 'google/gemini-2.5-flash', name: 'Google Gemini 2.5 Flash' },
  { id: 'openai/gpt-4o-mini', name: 'OpenAI GPT-4o Mini' },
];

const IMAGE_MODELS = [
  { id: 'Nano Banana Pro', name: 'Google Flow — Nano Banana Pro (Gemini Pix 2 — Same as Step 5)' },
  { id: 'imagen-3.0-generate-002', name: 'Google Imagen 3' },
  { id: 'recraft-v3', name: 'Recraft V3 (Visual Vector 2D)' },
  { id: 'flux-schnell', name: 'FLUX Schnell' },
  { id: 'dall-e-3', name: 'OpenAI DALL-E 3' },
];

const RESOLUTION_OPTIONS = [
  { size: '1280x720', label: '1280x720 (720p Landscape — Default Waku)' },
  { size: '1024x576', label: '1024x576 (Low HD 16:9 — Super Hemat)' },
  { size: '1792x1024', label: '1792x1024 (16:9 Full HD Landscape)' },
];

export interface BatchTopicItem {
  id: number;
  title: string;
  summary?: string;
  hasTimeline?: boolean;
  search_keyphrases?: string[];
  ruthless_critique?: string;
  outlier_search_guide?: string;
  screenshot_path?: string;
}

const WakuThumbnailStep: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'metadata' | 'thumbnail'>('metadata');

  // Metadata State
  const [uploadMetadata, setUploadMetadata] = useState<WakuUploadMetadata | null>(null);
  const [selectedTitleIndex, setSelectedTitleIndex] = useState<number>(0);
  const [loadingMetadata, setLoadingMetadata] = useState<boolean>(false);
  const [streamingMetadataText, setStreamingMetadataText] = useState<string>('');

  // Thumbnail State
  const [concepts, setConcepts] = useState<WakuThumbnailConcept[]>([]);
  const [renderedThumbnails, setRenderedThumbnails] = useState<WakuThumbnailConcept[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [aiModel, setAiModel] = useState<string>('ag/gemini-3-flash-agent');
  const [imageModel, setImageModel] = useState<string>('Nano Banana Pro');
  const [imageSize, setImageSize] = useState<string>('1280x720');

  const [loadingPrompts, setLoadingPrompts] = useState<boolean>(false);
  const [streamingText, setStreamingText] = useState<string>('');

  const [loadingImages, setLoadingImages] = useState<boolean>(false);
  const [imageProgress, setImageProgress] = useState<{ current: number; total: number; message: string } | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // Interactive Upload Checklist State
  const [checklist, setChecklist] = useState<{ [key: string]: boolean }>({
    trigger: false,
    detection: false,
    textLength: false,
    titleElement: false,
    alignment: false,
    scrollTest: false,
  });

  const toggleChecklist = (key: string) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const checkedCount = Object.values(checklist).filter(Boolean).length;

  const api = window.electronAPI;

  // Batch Topics State
  const [batchTopics, setBatchTopics] = useState<BatchTopicItem[]>([]);
  const [activeTopicId, setActiveTopicId] = useState<number | null>(null);
  const [videoTitle, setVideoTitle] = useState<string>('');

  const handleUploadScreenshot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeTopicId) return;

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        setBatchTopics((prev) =>
          prev.map((t) => (t.id === activeTopicId ? { ...t, screenshot_path: base64Data } : t))
        );

        if (api?.readFromProject && api?.saveToProject) {
          const topicsJson = await api.readFromProject('input/vann/topics.json');
          if (topicsJson) {
            const data = JSON.parse(topicsJson);
            if (Array.isArray(data.topics)) {
              data.topics = data.topics.map((t: any) =>
                t.id === activeTopicId ? { ...t, screenshot_path: base64Data } : t
              );
            }
            if (Array.isArray(data.selectedTopics)) {
              data.selectedTopics = data.selectedTopics.map((t: any) =>
                t.id === activeTopicId ? { ...t, screenshot_path: base64Data } : t
              );
            }
            await api.saveToProject('input/vann/topics.json', JSON.stringify(data, null, 2));
          }
        }
        setSuccessMsg('📸 Screenshot bukti outlier berhasil disimpan!');
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setErrorMsg(`❌ Gagal mengunggah screenshot: ${err.message}`);
    }
  };

  const loadTopicData = async (topicId: number) => {
    setUploadMetadata(null);
    setConcepts([]);
    setRenderedThumbnails([]);
    setSelectedId(null);
    setStreamingText('');
    setStreamingMetadataText('');
    setErrorMsg(null);
    setSuccessMsg(null);

    if (api?.getWakuUploadMetadata) {
      try {
        const meta = await api.getWakuUploadMetadata(topicId);
        if (meta && meta.titles) {
          setUploadMetadata(meta);
        }
      } catch (err) {
        console.warn('Error loading upload metadata:', err);
      }
    }

    if (api?.getWakuThumbnails) {
      try {
        const res = await api.getWakuThumbnails(topicId);
        if (res?.concepts && res.concepts.length > 0) {
          setConcepts(res.concepts);
        }
        if (res?.rendered && res.rendered.length > 0) {
          setRenderedThumbnails(res.rendered);
        }
        if (res?.selected) {
          setSelectedId(res.selected.selectedId);
        }
      } catch (err: any) {
        console.warn('Failed to load thumbnail data:', err);
      }
    }
  };

  const handleSelectTopic = async (topic: BatchTopicItem) => {
    setActiveTopicId(topic.id);
    setVideoTitle(topic.title);
    await loadTopicData(topic.id);
  };

  // Load existing data on mount
  useEffect(() => {
    (async () => {
      let loadedTopics: BatchTopicItem[] = [];
      if (api?.readFromProject) {
        try {
          const topicsJson = await api.readFromProject('input/vann/topics.json');
          let selectedId: number | null = null;
          if (topicsJson) {
            const topicState = JSON.parse(topicsJson);
            if (Array.isArray(topicState.selectedTopics) && topicState.selectedTopics.length > 0) {
              loadedTopics = topicState.selectedTopics.map((t: any) => ({
                id: t.id,
                title: t.title,
                summary: t.summary,
                search_keyphrases: t.search_keyphrases,
                ruthless_critique: t.ruthless_critique,
                outlier_search_guide: t.outlier_search_guide,
                screenshot_path: t.screenshot_path || t.screenshot_url,
              }));
              selectedId = topicState.selectedTopicId || loadedTopics[0]?.id || null;
            } else if (Array.isArray(topicState.topics) && topicState.selectedTopicId) {
              const matched = topicState.topics.find((t: any) => t.id === topicState.selectedTopicId);
              if (matched) {
                loadedTopics = [{
                  id: matched.id,
                  title: matched.title,
                  summary: matched.summary,
                  search_keyphrases: matched.search_keyphrases,
                  ruthless_critique: matched.ruthless_critique,
                  outlier_search_guide: matched.outlier_search_guide,
                  screenshot_path: matched.screenshot_path || matched.screenshot_url,
                }];
                selectedId = matched.id;
              }
            }
            setBatchTopics(loadedTopics);
          }

          if (loadedTopics.length > 0) {
            const activeId = selectedId !== null ? selectedId : loadedTopics[0].id;
            const matchedTopic = loadedTopics.find((t) => t.id === activeId) || loadedTopics[0];
            setActiveTopicId(matchedTopic.id);
            setVideoTitle(matchedTopic.title);
            await loadTopicData(matchedTopic.id);
          }
        } catch (err) {
          console.warn('Failed to load topics.json:', err);
        }
      }
    })();

    // Listeners
    const cleanupMetaStream = api?.onWakuUploadMetadataChunk?.((data) => {
      setStreamingMetadataText(data.fullText || '');
    });

    const cleanupStream = api?.onWakuThumbnailPromptsChunk?.((data) => {
      setStreamingText(data.fullText || '');
    });

    const cleanupImageProg = api?.onWakuThumbnailImageProgress?.((data) => {
      setImageProgress({
        current: data.current,
        total: data.total,
        message: data.message,
      });

      if (data.item) {
        setRenderedThumbnails((prev) => {
          const exists = prev.some((p) => p.id === data.conceptId);
          if (exists) {
            return prev.map((p) => (p.id === data.conceptId ? { ...p, ...data.item } : p));
          }
          return [...prev, data.item!];
        });
      }
    });

    return () => {
      if (cleanupMetaStream) cleanupMetaStream();
      if (cleanupStream) cleanupStream();
      if (cleanupImageProg) cleanupImageProg();
    };
  }, [api]);

  const [loadingKeyphrases, setLoadingKeyphrases] = useState<boolean>(false);

  // Handler: Generate Keyphrases for Active Topic if missing or user wants to refresh
  const handleGenerateKeyphrasesForActiveTopic = async () => {
    const activeItem = batchTopics.find((t) => t.id === activeTopicId) || batchTopics[0];
    if (!activeItem) return;

    setLoadingKeyphrases(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      let promptTemplate = '';
      if (api?.readFromProject) {
        promptTemplate = (await api.readFromProject('dashboard/prompts/vann/demand-keyphrases-prompt.md')) || '';
      }

      if (!promptTemplate || !promptTemplate.trim()) {
        throw new Error('File prompt dashboard/prompts/vann/demand-keyphrases-prompt.md tidak ditemukan.');
      }

      const topicSummaryList = `- ID ${activeItem.id}: "${activeItem.title}" (Ringkasan: ${activeItem.summary || ''})`;
      const computedPrompt = promptTemplate
        .replace(/{jumlah}/g, '1')
        .replace(/{daftar_topik}/g, topicSummaryList);

      if (!api?.generateWakuTopics) {
        throw new Error('API generateWakuTopics tidak tersedia pada Electron preload.');
      }

      const res = await api.generateWakuTopics(computedPrompt, aiModel);
      const rawContent = res?.rawText || JSON.stringify(res);

      let cleaned = rawContent.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
      }

      let parsed: any = null;
      try {
        parsed = JSON.parse(cleaned);
      } catch (err) {}

      const keyphraseList: any[] = parsed?.topics_keyphrases || parsed?.topics || (Array.isArray(parsed) ? parsed : []);
      const matched = keyphraseList.find((k: any) => Number(k.id) === activeItem.id) || keyphraseList[0];

      if (matched && Array.isArray(matched.search_keyphrases)) {
        const newKeyphrases = matched.search_keyphrases.map((x: any) => String(x).trim());
        const newCritique = matched.ruthless_critique || activeItem.ruthless_critique;
        const newGuide = matched.outlier_search_guide || activeItem.outlier_search_guide;

        setBatchTopics((prev) =>
          prev.map((t) =>
            t.id === activeItem.id
              ? {
                  ...t,
                  search_keyphrases: newKeyphrases,
                  ruthless_critique: newCritique,
                  outlier_search_guide: newGuide,
                }
              : t
          )
        );

        if (api?.readFromProject && api?.saveToProject) {
          const topicsJson = await api.readFromProject('input/vann/topics.json');
          if (topicsJson) {
            const data = JSON.parse(topicsJson);
            if (Array.isArray(data.topics)) {
              data.topics = data.topics.map((t: any) =>
                t.id === activeItem.id
                  ? {
                      ...t,
                      search_keyphrases: newKeyphrases,
                      ruthless_critique: newCritique,
                      outlier_search_guide: newGuide,
                    }
                  : t
              );
            }
            if (Array.isArray(data.selectedTopics)) {
              data.selectedTopics = data.selectedTopics.map((t: any) =>
                t.id === activeItem.id
                  ? {
                      ...t,
                      search_keyphrases: newKeyphrases,
                      ruthless_critique: newCritique,
                      outlier_search_guide: newGuide,
                    }
                  : t
              );
            }
            await api.saveToProject('input/vann/topics.json', JSON.stringify(data, null, 2));
          }
        }
        setSuccessMsg(`✨ Kata kunci pencarian berhasil dibuat untuk Topic #${activeItem.id}!`);
      } else {
        throw new Error('Format kata kunci dari AI tidak sesuai.');
      }
    } catch (err: any) {
      setErrorMsg(`❌ Gagal me-generate kata kunci: ${err.message}`);
    } finally {
      setLoadingKeyphrases(false);
    }
  };

  // Handler: Generate YouTube Upload Metadata (SEO Titles, Description, Tags)
  const handleGenerateMetadata = async () => {
    setLoadingMetadata(true);
    setStreamingMetadataText('');
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (!api?.generateWakuUploadMetadata) {
        throw new Error('IPC handler generateWakuUploadMetadata tidak tersedia.');
      }

      let scriptContent = '';
      if (api.readFromProject && activeTopicId) {
        scriptContent = (await api.readFromProject(`input/vann/scripts/full_script_topic_${activeTopicId}.txt`)) || '';
        if (!scriptContent) {
          scriptContent = (await api.readFromProject(`input/vann/full_script_topic_${activeTopicId}.txt`)) || '';
        }
        if (!scriptContent) {
          scriptContent = (await api.readFromProject('input/vann/full_script.txt')) || '';
        }
      }

      const res = await api.generateWakuUploadMetadata(
        scriptContent,
        videoTitle || 'Waku Educational Facts',
        aiModel,
        activeTopicId || undefined
      );

      if (res && res.titles && res.titles.length > 0) {
        setUploadMetadata(res);
        setSuccessMsg('🎉 Material Upload YouTube berhasil dibuat! Klik "2. Analisis Metadata & Centang Checklist" untuk menganalisis psikologi penonton.');
      } else {
        throw new Error('Gagal menghasilkan material upload YouTube.');
      }
    } catch (err: any) {
      setErrorMsg(`❌ Error Generate Upload Metadata: ${err.message}`);
    } finally {
      setLoadingMetadata(false);
    }
  };

  const [analyzingMetadata, setAnalyzingMetadata] = useState<boolean>(false);

  // Handler: Step 2 Standalone Metadata Psychological & Strategic Analysis
  const handleAnalyzeMetadata = async () => {
    if (!uploadMetadata) return;
    setAnalyzingMetadata(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (!api?.analyzeWakuMetadata) {
        throw new Error('IPC handler analyzeWakuMetadata tidak tersedia.');
      }

      const analysis = await api.analyzeWakuMetadata(
        videoTitle || 'Waku Educational Facts',
        uploadMetadata,
        aiModel,
        activeTopicId || undefined
      );

      if (analysis) {
        setUploadMetadata((prev) => (prev ? { ...prev, analysis, recommended_title: analysis.superior_title || prev.recommended_title } : null));

        if (analysis.superior_title && uploadMetadata.titles) {
          const idx = uploadMetadata.titles.findIndex((t) =>
            typeof t === 'string' ? t === analysis.superior_title : t.title === analysis.superior_title
          );
          if (idx !== -1) setSelectedTitleIndex(idx);
        }

        if (analysis.metadata_checklist) {
          const chk = analysis.metadata_checklist;
          setChecklist({
            trigger: !!chk.doom_scroll_stopper,
            detection: !!chk.title_length,
            textLength: !!chk.psychological_formula,
            titleElement: !!chk.psychological_formula,
            alignment: !!chk.description_hook,
            scrollTest: !!chk.seo_completeness,
          });
        }

        setSuccessMsg('🧠 Analisis psikologis & pemilihan judul terbaik selesai!');
      }
    } catch (err: any) {
      setErrorMsg(`❌ Error Analisis Metadata: ${err.message}`);
    } finally {
      setAnalyzingMetadata(false);
    }
  };

  const [fixingMetadata, setFixingMetadata] = useState<boolean>(false);

  // Handler: Auto-Fix Metadata based on AI Analysis
  const handleFixMetadata = async () => {
    if (!uploadMetadata || !uploadMetadata.analysis) return;
    setFixingMetadata(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (!api?.fixWakuMetadata) {
        throw new Error('IPC handler fixWakuMetadata tidak tersedia.');
      }

      const fixedMeta = await api.fixWakuMetadata(
        videoTitle || 'Waku Educational Facts',
        uploadMetadata,
        uploadMetadata.analysis,
        aiModel,
        activeTopicId || undefined
      );

      if (fixedMeta && fixedMeta.titles && fixedMeta.titles.length > 0) {
        setUploadMetadata(fixedMeta);
        setSuccessMsg('🎉 Metadata berhasil diperbaiki & dioptimalkan 100% oleh AI!');
      } else {
        throw new Error('Gagal memperbaiki metadata.');
      }
    } catch (err: any) {
      setErrorMsg(`❌ Error Fix Metadata: ${err.message}`);
    } finally {
      setFixingMetadata(false);
    }
  };

  // Handler: Generate 3 High-CTR Thumbnail Prompts
  const handleGeneratePrompts = async () => {
    setLoadingPrompts(true);
    setStreamingText('');
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (!api?.generateWakuThumbnailPrompts) {
        throw new Error('IPC handler generateWakuThumbnailPrompts tidak tersedia.');
      }

      let scriptContent = '';
      if (api.readFromProject && activeTopicId) {
        scriptContent = (await api.readFromProject(`input/vann/scripts/full_script_topic_${activeTopicId}.txt`)) || '';
        if (!scriptContent) {
          scriptContent = (await api.readFromProject(`input/vann/full_script_topic_${activeTopicId}.txt`)) || '';
        }
        if (!scriptContent) {
          scriptContent = (await api.readFromProject('input/vann/full_script.txt')) || '';
        }
      }

      // Ambil judul terpilih yang sudah dianalisis & diputuskan dari metadata
      const superiorTitle = uploadMetadata?.analysis?.superior_title;
      const recommendedTitle = uploadMetadata?.recommended_title;
      const selectedTitleObj = uploadMetadata?.titles?.[selectedTitleIndex];
      const manualTitleText = typeof selectedTitleObj === 'string'
        ? selectedTitleObj
        : selectedTitleObj?.title || undefined;

      const selectedTitleText = superiorTitle || recommendedTitle || manualTitleText || videoTitle;

      const res = await api.generateWakuThumbnailPrompts(
        scriptContent,
        videoTitle || 'Waku Educational Facts',
        selectedTitleText,
        uploadMetadata,
        'ag/gemini-3-flash-agent',
        activeTopicId || undefined
      );

      if (res?.concepts && res.concepts.length > 0) {
        setConcepts(res.concepts);
        setSuccessMsg('🎉 3 Konsep Prompt Thumbnail High-CTR berhasil dibuat!');
      } else {
        throw new Error('Gagal menghasilkan konsep prompt thumbnail.');
      }
    } catch (err: any) {
      setErrorMsg(`❌ Error Generate Prompt: ${err.message}`);
    } finally {
      setLoadingPrompts(false);
    }
  };

  // Handler: Generate 3 Thumbnail Images
  const handleGenerateImages = async () => {
    if (concepts.length === 0) {
      setErrorMsg('Silakan generate konsep prompt thumbnail terlebih dahulu.');
      return;
    }

    setLoadingImages(true);
    setImageProgress({ current: 0, total: concepts.length, message: 'Mempersiapkan generator gambar...' });
    setRenderedThumbnails([]);   // hapus hasil render lama dari UI
    setSelectedId(null);         // reset seleksi
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (!api?.generateWakuThumbnailImages) {
        throw new Error('IPC handler generateWakuThumbnailImages tidak tersedia.');
      }

      const results = await api.generateWakuThumbnailImages(concepts, imageModel, imageSize, activeTopicId || undefined);
      setRenderedThumbnails(results);

      // Auto select highest viral score if none selected
      const highest = [...results].sort((a, b) => (b.viral_score || 0) - (a.viral_score || 0))[0];
      if (highest && highest.id) {
        setSelectedId(highest.id);
        if (api.saveWakuThumbnailSelection) {
          await api.saveWakuThumbnailSelection(highest.id, highest, activeTopicId || undefined);
        }
      }

      setSuccessMsg('🎨 3 Gambar Thumbnail High-CTR berhasil di-render!');
    } catch (err: any) {
      setErrorMsg(`❌ Error Generate Image: ${err.message}`);
    } finally {
      setLoadingImages(false);
      setImageProgress(null);
    }
  };

  // Handler: Select Primary Thumbnail
  const handleSelectThumbnail = async (item: WakuThumbnailConcept) => {
    setSelectedId(item.id);
    setSuccessMsg(`✅ Thumbnail Concept #${item.id} ("${item.title}") dipilih sebagai Thumbnail Utama!`);
    try {
      if (api?.saveWakuThumbnailSelection) {
        await api.saveWakuThumbnailSelection(item.id, item, activeTopicId || undefined);
      }
    } catch (err: any) {
      console.warn('Error saving selection:', err);
    }
  };

  const [visionAnalysis, setVisionAnalysis] = useState<any>(null);
  const [analyzingVision, setAnalyzingVision] = useState<boolean>(false);

  // Handler: AI Vision Audit of 3 Rendered Thumbnail Images
  const handleAnalyzeThumbnailImages = async () => {
    if (renderedThumbnails.length === 0) {
      setErrorMsg('Silakan render 3 gambar thumbnail terlebih dahulu.');
      return;
    }
    setAnalyzingVision(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (!api?.analyzeWakuThumbnailImages) {
        throw new Error('IPC handler analyzeWakuThumbnailImages tidak tersedia.');
      }

      const superiorTitle = uploadMetadata?.analysis?.superior_title;
      const recommendedTitle = uploadMetadata?.recommended_title;
      const selectedTitleObj = uploadMetadata?.titles?.[selectedTitleIndex];
      const manualTitleText = typeof selectedTitleObj === 'string'
        ? selectedTitleObj
        : selectedTitleObj?.title || undefined;
      const selectedTitleText = superiorTitle || recommendedTitle || manualTitleText || videoTitle;

      const res = await api.analyzeWakuThumbnailImages(
        videoTitle || 'Waku Educational Facts',
        selectedTitleText,
        renderedThumbnails,
        'ag/gemini-3-flash-agent',
        activeTopicId || undefined
      );

      if (res) {
        setVisionAnalysis(res);
        if (res.winner_id) {
          setSelectedId(res.winner_id);
          const winnerItem = renderedThumbnails.find((t) => t.id === res.winner_id);
          if (winnerItem && api.saveWakuThumbnailSelection) {
            await api.saveWakuThumbnailSelection(winnerItem.id, winnerItem, activeTopicId || undefined);
          }
        }
        setSuccessMsg(`🧠 AI Vision berhasil menganalisis 3 thumbnail & memilih Thumbnail #${res.winner_id || 1} sebagai Pemenang Utama!`);
      }
    } catch (err: any) {
      setErrorMsg(`❌ Error Analisis Vision Thumbnail: ${err.message}`);
    } finally {
      setAnalyzingVision(false);
    }
  };

  const handleUpdatePromptText = (id: number, field: 'prompt' | 'text_overlay', value: string) => {
    setConcepts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-gray-900 to-emerald-950 border border-emerald-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold tracking-wider uppercase">
                🚀 VANN WORKFLOW — STEP 9: PUBLISH HUB & THUMBNAIL STUDIO
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold">
                🔥 SEO Titles, Description, Tags & 3x Thumbnail
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              YouTube Upload Materials & High-CTR Thumbnail Studio
            </h1>
            <p className="text-xs text-gray-300 max-w-2xl leading-relaxed">
              Buat seluruh bahan upload YouTube (Judul &lt;60 Karakter SEO, Deskripsi lengkap Timestamps, Tags) dan 3 variasi thumbnail kartun 2D/vektor ber-potensi viral dalam satu studio terpadu.
            </p>
          </div>

          {/* Tab Navigation Controls */}
          <div className="flex items-center gap-2 bg-gray-950 p-1.5 rounded-2xl border border-gray-800">
            <button
              onClick={() => setActiveTab('metadata')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'metadata'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <span>📝</span>
              <span>1. Upload SEO Metadata</span>
            </button>
            <button
              onClick={() => setActiveTab('thumbnail')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'thumbnail'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <span>🖼️</span>
              <span>2. Thumbnail Studio</span>
            </button>
          </div>
        </div>
      </div>

      {/* Batch Topics Tab Switcher */}
      {batchTopics.length > 1 && (
        <div className="flex flex-wrap gap-2 p-3 bg-gray-900/80 rounded-3xl border border-gray-800 shadow-2xl backdrop-blur-md">
          {batchTopics.map((top) => {
            const isActive = activeTopicId === top.id;
            return (
              <button
                key={top.id}
                onClick={() => handleSelectTopic(top)}
                className={`px-4 py-2 rounded-2xl text-xs font-black tracking-wide transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-500 text-white shadow-lg shadow-emerald-500/20 transform scale-[1.03]'
                    : 'bg-gray-950 text-gray-400 border border-gray-900 hover:border-gray-800 hover:text-gray-200 hover:bg-gray-900'
                }`}
              >
                <span>📌</span>
                <span>Topic {top.id}: {top.title.slice(0, 30)}{top.title.length > 30 ? '...' : ''}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs font-mono">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs font-mono">
          {successMsg}
        </div>
      )}

      {/* TAB 1: YOUTUBE UPLOAD METADATA (SEO TITLES, DESCRIPTION, TAGS) */}
      {activeTab === 'metadata' && (
        <div className="space-y-6">
          {/* Top Bar Action - 1-Click Generation */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gray-900/90 border border-gray-800 rounded-2xl p-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-emerald-400 font-mono">SEO MATERIAL GENERATOR</span>
              <p className="text-xs text-gray-300">
                Membuat 3 Judul SEO (&lt;60 Karakter), Deskripsi lengkap dengan Timestamps & CTA, 15-25 Tags, dan Hashtags sekaligus dalam 1-klik.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-200 font-mono focus:border-emerald-500 outline-none"
              >
                {TEXT_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>

              <button
                onClick={handleGenerateMetadata}
                disabled={loadingMetadata || analyzingMetadata}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/40 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loadingMetadata ? (
                  <>
                    <span className="animate-spin text-sm">⏳</span>
                    <span>Streaming SEO Metadata...</span>
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    <span>1. Generate Metadata</span>
                  </>
                )}
              </button>

              {uploadMetadata && (
                <button
                  onClick={handleAnalyzeMetadata}
                  disabled={loadingMetadata || analyzingMetadata}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-500 hover:to-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/40 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {analyzingMetadata ? (
                    <>
                      <span className="animate-spin text-sm">⏳</span>
                      <span>Menganalisis Psikologi...</span>
                    </>
                  ) : (
                    <>
                      <span>🧠</span>
                      <span>{uploadMetadata.analysis ? '🔄 Analisis Ulang Metadata' : '2. Analisis Metadata AI'}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* STREAMING TEXT OUTPUT FOR METADATA */}
          {loadingMetadata && (
            <div className="bg-gray-950 border border-emerald-500/40 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-emerald-400 font-bold">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  STREAMING REAL-TIME YOUTUBE SEO METADATA
                </span>
                <span>{streamingMetadataText.length} bytes</span>
              </div>
              <pre className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-[11px] text-gray-300 font-mono leading-relaxed overflow-x-auto max-h-48 whitespace-pre-wrap">
                {streamingMetadataText || 'Menghubungkan ke 9router AI SEO Studio...'}
              </pre>
            </div>
          )}

          {/* RESULTS DISPLAY FOR METADATA */}
          {uploadMetadata && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Left Column: Judul & Description */}
              <div className="md:col-span-8 space-y-6">
                {/* 1. TITLES (3 High-CTR Alternatives) */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <span>📌</span> 1. Judul Video (Maksimal 60 Karakter SEO)
                    </h2>
                    <span className="text-[11px] text-emerald-400 font-mono font-bold">Keyword Utama di Awal</span>
                  </div>

                  <div className="space-y-3">
                    {uploadMetadata.titles?.map((item, idx) => {
                      const titleText = typeof item === 'string' ? item : item.title;
                      const score = typeof item === 'object' ? item.ctr_score || (95 - idx * 3) : (95 - idx * 3);
                      const reason = typeof item === 'object' ? item.ctr_reason : null;

                      const charCount = titleText.length;
                      const isSelected = selectedTitleIndex === idx;
                      const isPerfectLen = charCount <= 60;
                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedTitleIndex(idx)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2.5 ${
                            isSelected
                              ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-xl ring-1 ring-emerald-500/40'
                              : 'bg-gray-950 border-gray-800 hover:border-gray-700 text-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-emerald-400">OPTION #{idx + 1}</span>
                              <span className={`px-2.5 py-0.5 rounded-full font-bold ${score >= 92 ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'}`}>
                                {score}% 🔥 CTR Rating
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className={`px-2.5 py-0.5 rounded-full font-bold ${isPerfectLen ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-red-950 text-red-300 border border-red-500/40'}`}>
                                {charCount} / 60 Chars {isPerfectLen ? '✓' : '⚠️ Over 60'}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(titleText);
                                }}
                                className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                              >
                                📋 Copy
                              </button>
                            </div>
                          </div>

                          <p className="text-xs font-mono font-bold leading-snug text-white">{titleText}</p>

                          {reason && (
                            <p className="text-[11px] text-gray-400 italic leading-relaxed pt-0.5 border-t border-gray-800/60">
                              "{reason}"
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. DESCRIPTION */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <span>📝</span> 2. Deskripsi Video (Hook, Timestamps & CTA)
                    </h2>
                    <button
                      onClick={() => navigator.clipboard.writeText(uploadMetadata.description || '')}
                      className="px-3 py-1 rounded-xl bg-gray-950 border border-gray-800 hover:border-emerald-500 text-emerald-400 text-xs font-mono font-bold transition-colors cursor-pointer"
                    >
                      📋 Copy Full Description
                    </button>
                  </div>

                  <textarea
                    rows={12}
                    value={uploadMetadata.description || ''}
                    onChange={(e) => setUploadMetadata({ ...uploadMetadata, description: e.target.value })}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3.5 text-xs text-gray-200 font-mono leading-relaxed focus:border-emerald-500 outline-none resize-none"
                  />
                </div>
              </div>

              {/* Right Column: Tags & Hashtags */}
              <div className="md:col-span-4 space-y-6">
                {/* 3. TAGS */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <span>🏷️</span> 3. Tags ({uploadMetadata.tags?.length || 0})
                    </h2>
                    <button
                      onClick={() => navigator.clipboard.writeText(uploadMetadata.tags?.join(', ') || '')}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 font-mono font-bold transition-colors cursor-pointer"
                    >
                      📋 Copy CSV
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-60 overflow-y-auto p-2 bg-gray-950 border border-gray-800 rounded-xl">
                    {uploadMetadata.tags?.map((tag, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 text-[11px] font-mono text-gray-300 hover:text-white"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 4. HASHTAGS */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <span>#️⃣</span> 4. Hashtags (YouTube Header)
                    </h2>
                    <button
                      onClick={() => navigator.clipboard.writeText(uploadMetadata.hashtags?.join(' ') || '')}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 font-mono font-bold transition-colors cursor-pointer"
                    >
                      📋 Copy
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 p-2 bg-gray-950 border border-gray-800 rounded-xl">
                    {uploadMetadata.hashtags?.map((tag, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 rounded-full bg-emerald-950 border border-emerald-500/30 text-xs font-mono font-bold text-emerald-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* AI PSYCHOLOGICAL & STRATEGIC METADATA ANALYSIS CARD */}
              {uploadMetadata.analysis && (
                <div className="md:col-span-12 bg-gray-900 border border-emerald-500/40 rounded-3xl p-6 space-y-5 shadow-2xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 bg-emerald-950 text-emerald-400 rounded-xl text-xs font-mono font-bold">🧠</span>
                      <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                        Analisis Psikologis & Keputusan AI (Penonton Doom Scrolling Indonesia)
                      </h3>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 text-xs font-mono font-bold">
                      AI Decision & Strategic Assessment
                    </span>
                  </div>

                  {/* Superior Title Callout */}
                  {uploadMetadata.analysis.superior_title && (
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/80 to-emerald-950/80 border border-emerald-500/60 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-emerald-500 text-gray-950 font-bold text-[10px] font-mono">
                          🏆 JUDUL PALING UNGGUL
                        </span>
                        <h4 className="text-sm font-bold text-emerald-200 font-mono">
                          "{uploadMetadata.analysis.superior_title}"
                        </h4>
                      </div>
                      {uploadMetadata.analysis.superior_reason && (
                        <p className="text-xs text-emerald-100/90 leading-relaxed font-sans pl-1">
                          💡 <strong className="font-mono text-emerald-300">Alasan Mengapa Unggul:</strong> {uploadMetadata.analysis.superior_reason}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Detailed Breakdown Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Box 1: Yang Sudah Bagus */}
                    {uploadMetadata.analysis.what_is_great && (
                      <div className="p-4 rounded-2xl bg-gray-950 border border-gray-800 space-y-1.5">
                        <span className="text-xs font-bold text-emerald-400 font-mono flex items-center gap-1.5">
                          <span>✅</span> Yang Sudah Sangat Bagus:
                        </span>
                        <p className="text-xs text-gray-300 leading-relaxed">
                          {uploadMetadata.analysis.what_is_great}
                        </p>
                      </div>
                    )}

                    {/* Box 2: Perlu Diperbaiki / Catatan + Auto-Fix Button */}
                    <div className="p-4 rounded-2xl bg-gray-950 border border-gray-800 space-y-3 flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <span className="text-xs font-bold text-emerald-400 font-mono flex items-center gap-1.5">
                          <span>🛠️</span> Perlu Diperhatikan / Catatan:
                        </span>
                        <p className="text-xs text-gray-300 leading-relaxed">
                          {uploadMetadata.analysis.areas_to_improve}
                        </p>

                        {uploadMetadata.analysis.improvements_needed && uploadMetadata.analysis.improvements_needed.length > 0 && (
                          <div className="pt-1 space-y-1">
                            {uploadMetadata.analysis.improvements_needed.map((imp, idx) => (
                              <div key={idx} className="text-[11px] text-emerald-300/90 font-mono bg-emerald-950/30 p-2 rounded-lg border border-emerald-900/40">
                                🎯 <strong className="uppercase">Target ({imp.target_field}):</strong> {imp.suggested_fix_instruction}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-gray-900">
                        <button
                          onClick={handleFixMetadata}
                          disabled={fixingMetadata}
                          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-gray-950 font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {fixingMetadata ? (
                            <>
                              <span className="animate-spin text-xs">⏳</span>
                              <span>Memperbaiki Metadata AI...</span>
                            </>
                          ) : (
                            <>
                              <span>🛠️</span>
                              <span>Auto-Fix / Perbaiki Metadata (AI)</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Box 3: Analisis Psikologi Penonton Indonesia */}
                    {uploadMetadata.analysis.psychological_analysis && (
                      <div className="p-4 rounded-2xl bg-gray-950 border border-gray-800 space-y-1.5">
                        <span className="text-xs font-bold text-emerald-400 font-mono flex items-center gap-1.5">
                          <span>🧠</span> Analisis Psikologis (Indonesian Audience):
                        </span>
                        <p className="text-xs text-gray-300 leading-relaxed">
                          {uploadMetadata.analysis.psychological_analysis}
                        </p>
                      </div>
                    )}

                    {/* Box 4: Dampak Waktu Doom Scrolling */}
                    {uploadMetadata.analysis.doom_scroll_impact && (
                      <div className="p-4 rounded-2xl bg-gray-950 border border-gray-800 space-y-1.5">
                        <span className="text-xs font-bold text-emerald-400 font-mono flex items-center gap-1.5">
                          <span>⚡</span> Dampak Saat Doom Scrolling (&lt;0.5 Detik):
                        </span>
                        <p className="text-xs text-gray-300 leading-relaxed">
                          {uploadMetadata.analysis.doom_scroll_impact}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AI THUMBNAIL STUDIO & VIRAL SCORE */}
      {activeTab === 'thumbnail' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gray-900/90 border border-gray-800 rounded-2xl p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-400">Model Image Generator (Sama Step 5):</label>
                <select
                  value={imageModel}
                  disabled={!uploadMetadata}
                  onChange={(e) => setImageModel(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-gray-200 font-mono focus:border-emerald-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {IMAGE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-400">Resolusi Thumbnail (16:9):</label>
                <select
                  value={imageSize}
                  disabled={!uploadMetadata}
                  onChange={(e) => setImageSize(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-gray-200 font-mono focus:border-emerald-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {RESOLUTION_OPTIONS.map((r) => (
                    <option key={r.size} value={r.size}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleGeneratePrompts}
                disabled={loadingPrompts || loadingImages || analyzingVision || !uploadMetadata}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/40 transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loadingPrompts ? '⏳ Streaming Prompts...' : '🚀 1. Generate 3 Prompts'}
              </button>

              {concepts.length > 0 && (
                <button
                  onClick={handleGenerateImages}
                  disabled={loadingPrompts || loadingImages || analyzingVision || !uploadMetadata}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/40 transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loadingImages ? '🎨 Rendering Images...' : '🖼️ 2. Render 3 Thumbnails'}
                </button>
              )}

              {renderedThumbnails.length > 0 && (
                <button
                  onClick={handleAnalyzeThumbnailImages}
                  disabled={loadingPrompts || loadingImages || analyzingVision || !uploadMetadata}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-500 hover:to-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/40 transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {analyzingVision ? (
                    <>
                      <span className="animate-spin text-xs">⏳</span>
                      <span>Menganalisis Vision AI...</span>
                    </>
                  ) : (
                    <>
                      <span>🧠</span>
                      <span>3. Analisis Vision & Pilih Otomatis</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* WARNING: Metadata belum di-generate */}
          {!uploadMetadata && (
            <div className="p-4 rounded-2xl bg-emerald-950/90 border border-emerald-500/60 text-emerald-200 text-xs font-mono flex items-start gap-3 shadow-xl">
              <span className="text-xl">⚠️</span>
              <div className="space-y-1">
                <strong className="text-emerald-300 font-bold block text-sm">Fitur Thumbnail Studio Terkunci (SEO Metadata Required)</strong>
                <p>
                  YouTube Upload Metadata belum dibuat untuk topik ini. Silakan masuk ke tab <strong>"1. Upload SEO Metadata"</strong> ➔ klik <strong>"1. Generate Metadata"</strong> ➔ tentukan judul video terbaik, lalu kembali ke tab ini.
                </p>
                <p className="text-[11px] text-emerald-400/80 italic">
                  Ini wajib dilakukan agar konsep visual thumbnail & teks overlay yang dihasilkan 100% selaras dengan judul video terpilih.
                </p>
              </div>
            </div>
          )}

          {/* STREAMING TEXT CONSOLE FOR THUMBNAIL PROMPTS */}
          {loadingPrompts && (
            <div className="bg-gray-950 border border-emerald-500/40 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-emerald-400 font-bold">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  STREAMING REAL-TIME PROMPT GENERATOR OUTPUT
                </span>
                <span>{streamingText.length} bytes</span>
              </div>
              <pre className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-[11px] text-gray-300 font-mono leading-relaxed overflow-x-auto max-h-48 whitespace-pre-wrap">
                {streamingText || 'Menghubungkan ke 9router AI Studio stream...'}
              </pre>
            </div>
          )}

          {/* REAL-TIME IMAGE GENERATION PROGRESS CARD */}
          {loadingImages && imageProgress && (
            <div className="bg-gray-950 border border-emerald-500/40 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-emerald-400 font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  PROSES GENERATE THUMBNAIL IMAGE ({imageProgress.current} / {imageProgress.total})
                </span>
                <span className="text-gray-400">
                  {Math.round((imageProgress.current / imageProgress.total) * 100)}% Complete
                </span>
              </div>

              <div className="w-full bg-gray-900 h-2.5 rounded-full overflow-hidden border border-gray-800">
                <div
                  className="bg-gradient-to-r from-emerald-500 via-emerald-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(imageProgress.current / imageProgress.total) * 100}%` }}
                />
              </div>

              <p className="text-xs text-gray-300 font-mono italic">
                {imageProgress.message}
              </p>
            </div>
          )}

          {/* SECTION 1: 3 THUMBNAIL PROMPT CONCEPTS */}
          {concepts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span>💡</span> 3 Konsep Prompt Thumbnail (High CTR Formula)
                </h2>
                <span className="text-xs text-gray-400 font-mono">Formula: 2D Cartoon, Split Contrast, Expressive Face</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {concepts.map((concept) => (
                  <div
                    key={concept.id}
                    className="bg-gray-900 border border-gray-800 hover:border-emerald-500/50 rounded-2xl p-4 space-y-3 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-400 font-mono">
                          CONCEPT #{concept.id}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                            (concept.viral_score || 90) >= 92
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                          }`}
                        >
                          {concept.viral_score || 90}% 🔥 Viral Score
                        </span>
                      </div>

                      <h3 className="text-xs font-bold text-white line-clamp-1">{concept.title}</h3>
                      <p className="text-[11px] text-gray-400 italic leading-relaxed">"{concept.viral_reason}"</p>

                      <div className="space-y-1 pt-1">
                        <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Teks Overlay Headline:</label>
                        <input
                          type="text"
                          value={concept.text_overlay || ''}
                          onChange={(e) => handleUpdatePromptText(concept.id, 'text_overlay', e.target.value)}
                          className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-emerald-300 font-mono font-bold focus:border-emerald-500 outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Prompt AI Image Generator:</label>
                        <textarea
                          rows={5}
                          value={concept.prompt}
                          onChange={(e) => handleUpdatePromptText(concept.id, 'prompt', e.target.value)}
                          className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-[11px] text-gray-300 font-mono leading-relaxed focus:border-emerald-500 outline-none resize-none"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between text-[10px] text-gray-500">
                      <span>Badge: <strong className="text-red-400 font-mono">{concept.badge_text || 'VS'}</strong></span>
                      <button
                        onClick={() => navigator.clipboard.writeText(concept.prompt)}
                        className="hover:text-emerald-400 transition-colors font-mono cursor-pointer"
                      >
                        📋 Copy Prompt
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 2: 3 RENDERED THUMBNAILS & SELECTION GRID */}
          {renderedThumbnails.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-gray-800">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span>🎨</span> Hasil Render 3 Thumbnail (Pilih Thumbnail Utama)
                </h2>
                <span className="text-xs text-emerald-400 font-mono">Aspect Ratio: 16:9 (YouTube Optimized)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {renderedThumbnails.map((item) => {
                  const isSelected = selectedId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`bg-gray-900 border rounded-3xl p-4 space-y-4 transition-all relative overflow-hidden ${
                        isSelected
                          ? 'border-emerald-500 shadow-xl shadow-emerald-950/60 ring-2 ring-emerald-500/50'
                          : 'border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      {/* Selection Ribbon */}
                      {isSelected && (
                        <div className="absolute top-0 right-0 bg-emerald-500 text-gray-950 text-[10px] font-black uppercase px-3 py-1 rounded-bl-xl shadow-md tracking-wider">
                          ★ SELECTED THUMBNAIL
                        </div>
                      )}

                      {/* Image Card Container */}
                      <div className="relative aspect-video bg-gray-950 rounded-2xl overflow-hidden border border-gray-800 group">
                        {item.url ? (
                          <img
                            src={item.url}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                            onClick={() => setFullscreenImage(item.url || null)}
                          />
                        ) : item.error ? (
                          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-xs text-red-400 bg-red-950/20">
                            <span>⚠️ Failed to render image</span>
                            <span className="text-[10px] text-red-500 font-mono mt-1">{item.error}</span>
                          </div>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-xs text-gray-500 gap-1">
                            <span className="animate-spin text-lg">🎨</span>
                            <span>Rendering Thumbnail #{item.id}...</span>
                          </div>
                        )}

                        {/* Simulation Headline Text Overlay on Image */}
                        {item.text_overlay && item.url && (
                          <div className="absolute bottom-2 left-2 right-2 bg-black/70 backdrop-blur-md border border-emerald-500/40 rounded-xl p-2 text-center">
                            <span className="text-xs font-black text-emerald-300 font-mono tracking-wider drop-shadow-md uppercase">
                              "{item.text_overlay}"
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Thumbnail Details & Viral Score */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-white line-clamp-1">{item.title}</h3>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold">
                            {item.viral_score || 90}% Viral Score
                          </span>
                        </div>

                        <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                          {item.viral_reason}
                        </p>

                        {/* Score Bar */}
                        <div className="space-y-1 pt-1">
                          <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                            <span>ESTIMATED CTR POTENTIAL</span>
                            <span className="text-emerald-400 font-bold">{item.viral_score || 90}%</span>
                          </div>
                          <div className="w-full bg-gray-950 h-2 rounded-full overflow-hidden border border-gray-800">
                            <div
                              className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                              style={{ width: `${item.viral_score || 90}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-2 border-t border-gray-800 flex items-center gap-2">
                        <button
                          onClick={() => handleSelectThumbnail(item)}
                          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500 text-gray-950 font-black shadow-lg shadow-emerald-500/20'
                              : 'bg-gray-800 hover:bg-gray-700 text-white'
                          }`}
                        >
                          {isSelected ? '✓ Primary Selected' : 'Pilih Thumbnail'}
                        </button>

                        {item.url && (
                          <a
                            href={item.url}
                            download={`waku_thumbnail_${item.id}.png`}
                            className="py-2 px-3 rounded-xl bg-gray-950 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white text-xs font-mono transition-colors flex items-center justify-center"
                            title="Download Thumbnail"
                          >
                            ⬇️
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VISION AI ANALYSIS & SELECTION AUDIT CARD */}
          {visionAnalysis && (
            <div className="bg-gray-900 border border-emerald-500/40 rounded-3xl p-6 space-y-5 shadow-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-emerald-950 text-emerald-400 rounded-xl text-xs font-mono font-bold">👁️</span>
                  <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                    Analisis Vision AI & Audit Psikologi Scrolling Manusia
                  </h3>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 text-xs font-mono font-bold">
                  Human Eye-Tracking & Pattern Interrupt Audit
                </span>
              </div>

              {/* Winner Callout */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/90 to-emerald-950/90 border border-emerald-500/60 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-500 text-gray-950 font-bold text-[10px] font-mono uppercase">
                    🏆 THUMBNAIL PEMENANG UTAMA
                  </span>
                  <h4 className="text-sm font-bold text-emerald-200 font-mono">
                    Thumbnail #{visionAnalysis.winner_id || 1} {visionAnalysis.winner_title ? `— ${visionAnalysis.winner_title}` : ''}
                  </h4>
                </div>
                {visionAnalysis.winner_reason && (
                  <p className="text-xs text-emerald-100/90 leading-relaxed pl-1">
                    💡 <strong className="font-mono text-emerald-300">Alasan Mengapa Paling Efektif Memutus Scrolling:</strong> {visionAnalysis.winner_reason}
                  </p>
                )}
              </div>

              {/* Human Scrolling Psychology Notes */}
              {visionAnalysis.human_scrolling_psychology_notes && (
                <div className="p-4 rounded-2xl bg-gray-950 border border-gray-800 space-y-1.5">
                  <span className="text-xs font-bold text-emerald-400 font-mono flex items-center gap-1.5">
                    <span>📱</span> Catatan Refleks Mata & Kebiasaan Penonton Indonesia:
                  </span>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {visionAnalysis.human_scrolling_psychology_notes}
                  </p>
                </div>
              )}

              {/* Evaluations breakdown */}
              {visionAnalysis.evaluations && visionAnalysis.evaluations.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  {visionAnalysis.evaluations.map((ev: any) => (
                    <div key={ev.id} className="p-4 rounded-2xl bg-gray-950 border border-gray-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between font-mono font-bold">
                        <span className="text-white">Thumbnail #{ev.id}</span>
                        <span className="text-emerald-400">{ev.thumb_stopping_score || 90}% Score</span>
                      </div>
                      {ev.strengths && <p className="text-[11px] text-emerald-300/90">✅ {ev.strengths}</p>}
                      {ev.weaknesses && <p className="text-[11px] text-emerald-300/90">⚠️ {ev.weaknesses}</p>}
                      {ev.scrolling_impact && <p className="text-[11px] text-gray-400 italic">⚡ {ev.scrolling_impact}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Fullscreen Image Preview Modal */}
      {fullscreenImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 cursor-pointer"
          onClick={() => setFullscreenImage(null)}
        >
          <div className="relative max-w-5xl max-h-full space-y-2">
            <img
              src={fullscreenImage}
              alt="Thumbnail Preview Fullscreen"
              className="max-h-[85vh] w-auto rounded-2xl border border-gray-800 shadow-2xl mx-auto"
            />
            <p className="text-center text-xs text-gray-400 font-mono">Klik di mana saja untuk menutup preview</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WakuThumbnailStep;
