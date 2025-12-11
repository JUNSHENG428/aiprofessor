# 🎓 AI Professor - Gemini Edition

<div align="center">

![AI Professor Banner](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)

**智能 PDF 课件讲解助手 | 基于 Google Gemini 2.5**

[![Made with React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)](https://vitejs.dev/)
[![Gemini](https://img.shields.io/badge/Gemini-2.5-4285F4?logo=google)](https://ai.google.dev/)

</div>

---

## ✨ 功能特性

- 📄 **PDF 智能解析** - 上传 PDF 课件，自动提取文本和图像
- 🎯 **分批讲解** - 按页批量讲解，深度解析每张幻灯片
- 🖼️ **视觉分析** - AI 识别并解释图表、公式、流程图
- 💬 **智能问答** - 针对当前内容提问，获取即时解答
- 📝 **模拟考试** - 自动生成考题并批改答案
- 📚 **一键总结** - 生成完整的复习指南
- 🌏 **中文翻译** - 一键翻译 AI 回复为中文
- 📥 **导出笔记** - 将对话记录导出为 Markdown 文件
- 🔧 **多模型支持** - 支持 Gemini、OpenAI、DeepSeek 等 API

---

## 🚀 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) 18+ 
- [Google Gemini API Key](https://aistudio.google.com/apikey) (免费获取)

### 本地运行

```bash
# 1. 克隆项目
git clone https://github.com/your-username/ai-professor-gemini.git
cd ai-professor-gemini

# 2. 安装依赖
npm install

# 3. 创建环境变量文件
# Windows
echo GEMINI_API_KEY=your_api_key_here > .env.local

# Mac/Linux
echo "GEMINI_API_KEY=your_api_key_here" > .env.local

# 4. 启动开发服务器
npm run dev
```

打开浏览器访问 `http://localhost:3000`

---

## 🌐 部署指南

### 方式一：Vercel 部署（推荐）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/ai-professor-gemini)

1. 点击上方按钮或访问 [Vercel](https://vercel.com)
2. 导入 GitHub 仓库
3. 在 **Environment Variables** 中添加：
   - `GEMINI_API_KEY` = 你的 API 密钥
4. 点击 **Deploy**

### 方式二：Netlify 部署

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start)

1. 访问 [Netlify](https://app.netlify.com)
2. 连接 GitHub 仓库
3. 构建设置会自动识别（已配置 `netlify.toml`）
4. 在 **Site settings > Environment variables** 中添加 `GEMINI_API_KEY`
5. 触发重新部署

### 方式三：手动部署

```bash
# 构建生产版本
npm run build

# 预览构建结果
npm run preview

# dist/ 目录即为可部署的静态文件
```

将 `dist/` 目录上传到任意静态托管服务：
- GitHub Pages
- Cloudflare Pages
- 阿里云 OSS
- 腾讯云 COS

---

## ⚙️ 配置说明

### 环境变量

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `GEMINI_API_KEY` | Google Gemini API 密钥 | 是* |

> *注：也可以在应用内的设置面板中配置 API Key

### 支持的 AI 模型

| 提供商 | 模型 | 特点 |
|--------|------|------|
| **Gemini** | gemini-2.5-flash | ⚡ 快速响应，支持视觉 |
| | gemini-2.5-pro | 🧠 更强推理能力 |
| **OpenAI** | gpt-4o | 🌐 通用强大 |
| | gpt-4-turbo | 📚 长上下文 |
| **DeepSeek** | deepseek-chat | 💰 高性价比 |

---

## 📁 项目结构

```
ai-professor-gemini/
├── components/          # React 组件
│   ├── Button.tsx       # 通用按钮组件
│   ├── ChatPanel.tsx    # 聊天面板
│   ├── LecturePanel.tsx # 讲解面板
│   ├── PdfViewer.tsx    # PDF 查看器
│   └── SettingsModal.tsx # 设置弹窗
├── services/            # 服务层
│   ├── aiService.ts     # AI API 调用
│   ├── geminiService.ts # Gemini 特定服务
│   └── pdfService.ts    # PDF 解析服务
├── App.tsx              # 主应用组件
├── index.tsx            # 应用入口
├── index.html           # HTML 模板
├── index.css            # 全局样式
├── types.ts             # TypeScript 类型定义
├── constants.ts         # 常量和提示词
├── vite.config.ts       # Vite 配置
├── vercel.json          # Vercel 部署配置
├── netlify.toml         # Netlify 部署配置
└── package.json         # 项目依赖
```

---

## 🛠️ 技术栈

- **前端框架**: React 19 + TypeScript
- **构建工具**: Vite 6
- **样式方案**: Tailwind CSS (CDN)
- **PDF 解析**: PDF.js
- **Markdown 渲染**: react-markdown + remark-gfm
- **图标库**: Lucide React
- **AI SDK**: @google/genai

---

## 📝 使用说明

1. **上传 PDF** - 点击右上角 "Upload PDF" 按钮
2. **自动讲解** - AI 会自动开始讲解前几页
3. **翻页浏览** - 使用左侧 PDF 查看器导航
4. **切换批次** - 使用 "Current Batch" 控制切换讲解区域
5. **提问互动** - 在底部输入框提问
6. **翻译内容** - 悬停在 AI 回复上点击翻译按钮
7. **模拟考试** - 点击 "Mock Exam" 进行自我测试
8. **导出笔记** - 点击下载按钮保存对话记录

---

## 🔑 获取 API Key

### Google Gemini（推荐）

1. 访问 [Google AI Studio](https://aistudio.google.com/apikey)
2. 登录 Google 账号
3. 点击 "Create API Key"
4. 复制 API Key 到应用设置中

> 💡 Gemini API 每月有免费额度，适合个人学习使用

---

## 📄 许可证

MIT License © 2024

---

<div align="center">

**如果这个项目对你有帮助，请给个 ⭐ Star 支持一下！**

Made with ❤️ by AI Professor Team

</div>
