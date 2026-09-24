import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, Clock, Calendar, ChevronRight, BookOpen, CheckCircle2, FileText } from 'lucide-react';
import { loadArticleBySlug, loadQuizBySlug, getQuizSlugs, type QuizData } from '../lib/articles';
import type { ArticleMeta } from '../lib/frontmatter';
import { loadContent, type ContentData } from '../lib/contentService';
import { CONCEPTS, EDGES, CLUSTER_META, type Concept } from '../data/concepts';
import { LEARNING_PATH_DEFS } from '../data/learningPaths';
import { isArticleRead, markArticleRead } from '../lib/progress';
import NavBar from './NavBar';
import Quiz from './Quiz';

const fallbackContent: ContentData = {
  concepts: CONCEPTS,
  edges: EDGES,
  learningPathDefs: LEARNING_PATH_DEFS,
  conceptsMap: Object.fromEntries(CONCEPTS.map((c) => [c.id, c])),
};

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<{ meta: ArticleMeta; body: string } | null | undefined>(undefined);
  const [content, setContent] = useState<ContentData>(fallbackContent);
  const [quiz, setQuiz] = useState<QuizData | null | undefined>(undefined);
  const [read, setRead] = useState(false);

  const quizSlugs = getQuizSlugs();

  useEffect(() => {
    loadContent().then(setContent);
  }, []);

  useEffect(() => {
    if (!slug) return;
    setArticle(undefined);
    setQuiz(undefined);
    setRead(slug ? isArticleRead(slug) : false);
    loadArticleBySlug(slug).then(setArticle);
    if (slug && quizSlugs.has(slug)) {
      loadQuizBySlug(slug).then(setQuiz);
    } else {
      setQuiz(null);
    }
  }, [slug]);

  useEffect(() => {
    if (article?.meta?.title) {
      document.title = `${article.meta.title} | AI Systems DNA`;
    } else if (article === null) {
      document.title = 'Article Not Found | AI Systems DNA';
    }
  }, [article]);

  const handleMarkRead = () => {
    if (!slug) return;
    markArticleRead(slug);
    setRead(true);
  };

  const handleQuizComplete = () => {
    if (!slug) return;
    markArticleRead(slug);
    setRead(true);
  };

  if (article === undefined) {
    return (
      <div className="min-h-screen bg-[#080c14] text-white">
        <NavBar />
        <div className="pt-20 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse text-white/30 text-sm">Loading article…</div>
        </div>
      </div>
    );
  }

  if (article === null) {
    return (
      <div className="min-h-screen bg-[#080c14] text-white">
        <NavBar />
        <div className="pt-20 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <BookOpen className="w-10 h-10 text-white/20 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Article not found</h1>
          <p className="text-white/40 text-sm mb-6">This deep dive hasn't been published yet.</p>
          <Link to="/#deep-dives" className="inline-flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Deep Dives
          </Link>
        </div>
      </div>
    );
  }

  const { meta, body } = article;
  const relatedConcepts = meta.concepts
    .map((id) => content.conceptsMap[id])
    .filter((c): c is Concept => !!c);

  const backLink = meta.track === 'domain-builder'
    ? '/#domain-track'
    : '/#deep-dives';
  const backLabel = meta.track === 'domain-builder'
    ? 'Domain Platform Builder'
    : 'Deep Dives';

  return (
    <div className="min-h-screen bg-[#080c14] text-white font-sans antialiased">
      <NavBar />

      <div className="absolute inset-0 opacity-[0.025] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

      <article className="relative pt-14">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
          {/* Back link */}
          <Link
            to={backLink}
            className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors mb-8 group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            {backLabel}
          </Link>

          {/* Article header */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-blue-500/30 bg-blue-500/10 text-blue-300">
                {meta.category}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-white/30">
                <Clock className="w-3 h-3" /> {meta.readTime}
              </span>
              {meta.updated && (
                <span className="flex items-center gap-1 text-[11px] text-white/30">
                  <Calendar className="w-3 h-3" /> Updated {meta.updated}
                </span>
              )}
              {read && (
                <span className="flex items-center gap-1 text-[11px] text-green-400">
                  <CheckCircle2 className="w-3 h-3" /> Read
                </span>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight text-white mb-4">
              {meta.title}
            </h1>
            <p className="text-lg text-white/50 leading-relaxed">{meta.description}</p>
          </div>

          {/* Article body */}
          <div className="article-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
          </div>

          {/* Mark as read button */}
          {!read && (
            <div className="mt-8">
              <button
                onClick={handleMarkRead}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/[0.1] bg-white/[0.04] text-sm text-white/60 hover:text-white hover:bg-white/[0.08] transition-all"
              >
                <FileText className="w-3.5 h-3.5" />
                Mark as read
              </button>
            </div>
          )}

          {/* Quiz */}
          {quiz && (
            <Quiz quiz={quiz} onComplete={handleQuizComplete} />
          )}

          {/* Related concepts */}
          {relatedConcepts.length > 0 && (
            <div className="mt-16 pt-8 border-t border-white/[0.07]">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-white/35 mb-4">
                Related Concepts
              </h2>
              <div className="flex flex-wrap gap-2">
                {relatedConcepts.map((concept) => {
                  const clusterMeta = CLUSTER_META[concept.cluster];
                  return (
                    <Link
                      key={concept.id}
                      to={`/concepts/${concept.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
                      style={{
                        background: `${clusterMeta.glow}15`,
                        border: `1px solid ${clusterMeta.glow}35`,
                        color: clusterMeta.stroke,
                      }}
                    >
                      {concept.label}
                      <ChevronRight className="w-3 h-3 opacity-60" />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer back link */}
          <div className="mt-12 pt-8 border-t border-white/[0.05]">
            <Link
              to={backLink}
              className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back to {backLabel}
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}
