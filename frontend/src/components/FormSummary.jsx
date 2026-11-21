import { useEffect, useState } from "react";
import client from "../api/client";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react";

/**
 * Displays compact form header card: title, description clamped to 3 lines with Show more,
 * question count, AI chip from prewarm status, and optional Continue button.
 */
export default function FormSummary({
  title,
  description,
  questionCount,
  unsupportedCount,
  formKey,
  onContinue,
  showContinue = false,
}) {
  const [prewarmStatus, setPrewarmStatus] = useState("warming");
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!formKey) return;

    let timer = null;
    let isMounted = true;

    async function pollStatus() {
      try {
        const res = await client.get(`/api/prewarm/${formKey}`);
        const status = res.data?.data?.status;
        if (!isMounted) return;

        if (status) {
          setPrewarmStatus(status);
        }

        if (status === "warming" || status === "idle") {
          timer = setTimeout(pollStatus, 2000);
        }
      } catch {
        if (isMounted) {
          setPrewarmStatus("failed");
        }
      }
    }

    pollStatus();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [formKey]);

  return (
    <div className="w-full rounded-lg border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Form Loaded
            </span>
          </div>
          <h3 className="text-base font-semibold text-slate-900 break-words">{title || "Untitled Form"}</h3>
          
          {description && (
            <div className="text-xs text-slate-600 leading-relaxed">
              <p className={!isExpanded ? "line-clamp-3" : ""}>{description}</p>
              {description.length > 180 && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  {isExpanded ? (
                    <>
                      <span>Show less</span>
                      <ChevronUp className="w-3 h-3" />
                    </>
                  ) : (
                    <>
                      <span>Show more</span>
                      <ChevronDown className="w-3 h-3" />
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* AI Prewarm Status Chip */}
        <div className="shrink-0">
          {prewarmStatus === "warming" && (
            <Badge variant="info" dot>
              Preparing AI answers...
            </Badge>
          )}
          {(prewarmStatus === "ready" || prewarmStatus === "partial") && (
            <Badge variant="success" dot>
              AI answers ready
            </Badge>
          )}
          {prewarmStatus === "failed" && (
            <Badge variant="neutral">
              Basic templates fallback
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">
            {questionCount} question{questionCount !== 1 ? "s" : ""}
          </Badge>
          {unsupportedCount > 0 && (
            <Badge variant="warning">
              {unsupportedCount} unsupported
            </Badge>
          )}
        </div>

        {showContinue && onContinue && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onContinue}
            icon={ArrowRight}
          >
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}
