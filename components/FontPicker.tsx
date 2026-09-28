"use client";

import { useCallback, useEffect, useState } from "react";
import "./FontPicker.css";

/**
 * FontPicker —— 中文字体挑选面板（任务 #55 初建 / #59 扩充）
 *
 * 右下角常驻圆形 "A" 按钮，点开面板按「衬线 / 无衬线（黑体）/ 楷体 /
 * 系统字体」分组列出中文候选：项目内置（@font-face 注册于 globals.css）、
 * 本地开源 webfont（@font-face css 位于 public/fonts/<name>/，挂载时注入
 * <link>，unicode-range 分片按需下载）与 Windows 系统字体。
 * 点选后把字体写入 documentElement 的 --zh-font 变量并持久化到
 * localStorage，全站中文文本（font-family 栈含 var(--zh-font, …) 的元素）
 * 立即切换；"默认"项清除变量——无衬线栈回退微软雅黑
 * （.mm-tab 的 var(--zh-font, "Microsoft YaHei") fallback），
 * 衬线栈维持原 serif 回退。
 * 系统字体用 canvas 量宽检测，检测不到的候选直接隐藏（选了没效果）。
 * z-index 9000，低于 TiltedCard 作品浮层（9999）。
 */

/** 单个字体候选 */
type FontOption = {
  /** 唯一 id */
  id: string;
  /** 展示名 */
  label: string;
  /** 写入 --zh-font 的 font-family 值 */
  value: string;
  /** 预览字体类（FontPicker.css 中 fp-preview-*，用该字体渲染示例文本） */
  previewClass: string;
  /** 来源标注 */
  source: "内置" | "系统" | "开源";
  /** 系统字体检测用族名（canvas 量宽）；缺省 = 非系统字体，始终显示 */
  systemFamily?: string;
};

/** 候选分组 */
type FontGroup = {
  id: string;
  label: string;
  options: FontOption[];
};

const STORAGE_KEY = "gk3-zh-font";

/** 预览示例文本 */
const SAMPLE_TEXT = "中文字体 永和九年";

/** 本地开源 webfont 的 @font-face css（unicode-range 分片，本地文件按需加载） */
const WEBFONT_CSS = [
  "/fonts/lxgw-wenkai/lxgwwenkai-regular.css",
  "/fonts/smiley-sans/font.css",
  "/fonts/misans/MiSansVF.min.css",
  "/fonts/noto-sans-sc/400.css",
];

/** 全部候选，按「衬线 / 无衬线（黑体）/ 楷体 / 系统字体」分组 */
const FONT_GROUPS: FontGroup[] = [
  {
    id: "serif",
    label: "衬线",
    options: [
      {
        id: "source-han-serif",
        label: "思源宋体",
        value: '"Source Han Serif CN"',
        previewClass: "fp-preview-source-han",
        source: "内置",
      },
      {
        id: "fz-xiaobiaosong",
        label: "方正小标宋",
        value: '"FZXiaoBiaoSong"',
        previewClass: "fp-preview-fz",
        source: "内置",
      },
      {
        id: "simsun",
        label: "宋体",
        value: "SimSun",
        previewClass: "fp-preview-simsun",
        source: "系统",
        systemFamily: "SimSun",
      },
    ],
  },
  {
    id: "sans",
    label: "无衬线（黑体）",
    options: [
      {
        id: "microsoft-yahei",
        label: "微软雅黑",
        value: '"Microsoft YaHei"',
        previewClass: "fp-preview-yahei",
        source: "系统",
        systemFamily: "Microsoft YaHei",
      },
      {
        id: "noto-sans-sc",
        label: "思源黑体",
        value: '"Noto Sans SC"',
        previewClass: "fp-preview-noto",
        source: "开源",
      },
      {
        id: "misans",
        label: "MiSans",
        value: '"MiSans VF"',
        previewClass: "fp-preview-misans",
        source: "开源",
      },
      {
        id: "smiley-sans",
        label: "得意黑",
        value: '"Smiley Sans Oblique"',
        previewClass: "fp-preview-smiley",
        source: "开源",
      },
      {
        id: "simhei",
        label: "黑体",
        value: "SimHei",
        previewClass: "fp-preview-simhei",
        source: "系统",
        systemFamily: "SimHei",
      },
      {
        id: "dengxian",
        label: "等线",
        value: "DengXian",
        previewClass: "fp-preview-dengxian",
        source: "系统",
        systemFamily: "DengXian",
      },
    ],
  },
  {
    id: "kaiti",
    label: "楷体",
    options: [
      {
        id: "lxgw-wenkai",
        label: "霞鹜文楷",
        value: '"LXGW WenKai"',
        previewClass: "fp-preview-lxgw",
        source: "开源",
      },
      {
        id: "kaiti",
        label: "楷体",
        value: "KaiTi",
        previewClass: "fp-preview-kaiti",
        source: "系统",
        systemFamily: "KaiTi",
      },
    ],
  },
  {
    id: "system",
    label: "系统字体",
    options: [
      {
        id: "fangsong",
        label: "仿宋",
        value: "FangSong",
        previewClass: "fp-preview-fangsong",
        source: "系统",
        systemFamily: "FangSong",
      },
      {
        id: "nsimsun",
        label: "新宋体",
        value: "NSimSun",
        previewClass: "fp-preview-nsimsun",
        source: "系统",
        systemFamily: "NSimSun",
      },
      {
        id: "stkaiti",
        label: "华文楷体",
        value: "STKaiti",
        previewClass: "fp-preview-stkaiti",
        source: "系统",
        systemFamily: "STKaiti",
      },
      {
        id: "stsong",
        label: "华文宋体",
        value: "STSong",
        previewClass: "fp-preview-stsong",
        source: "系统",
        systemFamily: "STSong",
      },
      {
        id: "stzhongsong",
        label: "华文中宋",
        value: "STZhongsong",
        previewClass: "fp-preview-stzhongsong",
        source: "系统",
        systemFamily: "STZhongsong",
      },
      {
        id: "stfangsong",
        label: "华文仿宋",
        value: "STFangsong",
        previewClass: "fp-preview-stfangsong",
        source: "系统",
        systemFamily: "STFangsong",
      },
      {
        id: "stxihei",
        label: "华文细黑",
        value: "STXihei",
        previewClass: "fp-preview-stxihei",
        source: "系统",
        systemFamily: "STXihei",
      },
      {
        id: "lisu",
        label: "隶书",
        value: "LiSu",
        previewClass: "fp-preview-lisu",
        source: "系统",
        systemFamily: "LiSu",
      },
      {
        id: "youyuan",
        label: "幼圆",
        value: "YouYuan",
        previewClass: "fp-preview-youyuan",
        source: "系统",
        systemFamily: "YouYuan",
      },
    ],
  },
];

const ALL_OPTIONS: FontOption[] = FONT_GROUPS.flatMap((group) => group.options);

/** canvas 量宽检测的样本文本（含中文与拉丁，任何 CJK 字体都会显著偏离基线） */
const DETECT_TEXT = "永和九年中文字体 AaBb123";

/**
 * canvas 量宽检测系统字体是否存在：
 * 以 monospace 为基线，"72px <family>, monospace" 渲染宽度与基线不同
 * ⇒ family 提供了字形 ⇒ 存在；相同 ⇒ 回退到了 monospace ⇒ 不存在。
 */
function detectAvailableSystemFonts(): Set<string> {
  const found = new Set<string>();
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return found;
    ctx.font = `72px monospace`;
    const base = ctx.measureText(DETECT_TEXT).width;
    for (const option of ALL_OPTIONS) {
      if (!option.systemFamily) continue;
      try {
        ctx.font = `72px "${option.systemFamily}", monospace`;
        if (Math.abs(ctx.measureText(DETECT_TEXT).width - base) > 0.5) {
          found.add(option.systemFamily);
        }
      } catch {
        // 单个字体检测失败按不存在处理
      }
    }
  } catch {
    // canvas 不可用：found 保持空集（系统组隐藏，内置/开源组不受影响）
  }
  return found;
}

/** 把选中字体写入根元素变量并持久化；value 为 null 表示恢复默认 */
function applyFont(value: string | null) {
  const root = document.documentElement;
  if (value) {
    root.style.setProperty("--zh-font", value);
  } else {
    root.style.removeProperty("--zh-font");
  }
  try {
    if (value) {
      window.localStorage.setItem(STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage 不可用（隐私模式等）：本次会话仍实时生效，刷新后不保留
  }
}

/** 从 localStorage 读取上次选择；非法值一律忽略 */
function readStoredFont(): string | null {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && ALL_OPTIONS.some((option) => option.value === saved)) {
      return saved;
    }
  } catch {
    // ignore
  }
  return null;
}

export function FontPicker() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  /** 已安装的系统字体族名集合；null = 检测未完成（先全部显示） */
  const [detected, setDetected] = useState<Set<string> | null>(null);

  // 挂载时注入本地开源 webfont 的 @font-face css（data-fp-font 防重复）
  useEffect(() => {
    for (const href of WEBFONT_CSS) {
      if (document.querySelector(`link[data-fp-font="${href}"]`)) continue;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.fpFont = href;
      document.head.appendChild(link);
    }
  }, []);

  // 挂载时检测系统字体（同步 canvas 量宽，毫秒级）
  useEffect(() => {
    setDetected(detectAvailableSystemFonts());
  }, []);

  // 挂载时恢复上次选择（刷新后保留）
  useEffect(() => {
    const saved = readStoredFont();
    if (saved) {
      document.documentElement.style.setProperty("--zh-font", saved);
      setSelected(saved);
    }
  }, []);

  const handleSelect = useCallback((option: FontOption) => {
    applyFont(option.value);
    setSelected(option.value);
  }, []);

  const handleReset = useCallback(() => {
    applyFont(null);
    setSelected(null);
  }, []);

  return (
    <div className="fp-root">
      {open && (
        <div className="fp-panel" role="dialog" aria-label="挑选中文字体">
          <div className="fp-panel-header">
            <span className="fp-panel-title">中文字体</span>
            <button
              type="button"
              className="fp-close"
              onClick={() => setOpen(false)}
              aria-label="关闭字体面板"
            >
              ×
            </button>
          </div>
          <ul className="fp-list">
            <li>
              <button
                type="button"
                className={`fp-item${selected === null ? " fp-item-active" : ""}`}
                onClick={handleReset}
              >
                <span className="fp-item-sample">中文字体 永和九年</span>
                <span className="fp-item-meta">
                  <span className="fp-item-name">默认</span>
                  <span className="fp-item-tag">无衬线=雅黑</span>
                </span>
              </button>
            </li>
            {FONT_GROUPS.map((group) => {
              // 系统字体按检测结果过滤；检测未完成（null）时先全部显示
              const visible = group.options.filter(
                (option) =>
                  !option.systemFamily ||
                  detected === null ||
                  detected.has(option.systemFamily)
              );
              if (visible.length === 0) return null;
              return (
                <li key={group.id} className="fp-group">
                  <div className="fp-group-label">{group.label}</div>
                  <ul className="fp-group-list">
                    {visible.map((option) => (
                      <li key={option.id}>
                        <button
                          type="button"
                          className={`fp-item${
                            selected === option.value ? " fp-item-active" : ""
                          }`}
                          onClick={() => handleSelect(option)}
                        >
                          <span
                            className={`fp-item-sample ${option.previewClass}`}
                          >
                            {SAMPLE_TEXT}
                          </span>
                          <span className="fp-item-meta">
                            <span className="fp-item-name">{option.label}</span>
                            <span className="fp-item-tag">{option.source}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <button
        type="button"
        className={`fp-toggle${open ? " fp-toggle-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="挑选中文字体"
        title="挑选中文字体"
      >
        A
      </button>
    </div>
  );
}
