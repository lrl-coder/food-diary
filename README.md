# 饮食日记

这是一个可以部署到 GitHub Pages 的纯前端饮食记录应用。

## AI 识别配置

浏览器不能直接从 `https://lrl-coder.github.io` 请求 `https://api.openai.com/v1/chat/completions`，否则会被 OpenAI 的 CORS 策略拦截。正确做法是让 GitHub Pages 调用你自己的后端代理，再由代理调用 OpenAI。

仓库里提供了一个 Cloudflare Worker 示例：`openai-proxy-worker.js`。

### Cloudflare Worker 部署步骤

1. 在 Cloudflare 新建一个 Worker。
2. 把 `openai-proxy-worker.js` 的内容粘贴进去并部署。
3. 在 Worker 的环境变量里设置：
   - `OPENAI_API_KEY`: 你的 OpenAI API Key
   - `ALLOWED_ORIGIN`: `https://lrl-coder.github.io`
   - `OPENAI_MODEL`: 可选，默认是 `gpt-5-nano`
4. Worker 部署后会得到类似这样的地址：

```text
https://your-worker.your-name.workers.dev
```

5. 打开 GitHub Pages 上的应用，点击右上角设置，把代理地址填成：

```text
https://your-worker.your-name.workers.dev/analyze
```

之后拍照识别会走这个代理，API Key 不会暴露在浏览器里。
