# 测对儿 web demo · 部署到 Vercel

前端(index.html / xray.html)+ 多 Agent AI 后端(api/）一个项目一起部署,一条链接。

## 一次性:装 CLI + 登录(你来做,要开浏览器)
```
npm i -g vercel
vercel login        # 浏览器里点确认
```

## 部署(可让 Claude 代跑,或自己跑)
```
cd ~/cedui-demo
vercel --yes                 # 首次:创建项目(默认设置)

# 配 3 个环境变量(DeepSeek)
vercel env add LLM_API_KEY production       # 粘贴 sk- 开头的 key
vercel env add LLM_BASE_URL production      # 填 https://api.deepseek.com
vercel env add LLM_MODEL production         # 填 deepseek-chat

vercel --prod                # 正式部署,拿到 https://xxx.vercel.app
```

## 验证
- 打开 `https://xxx.vercel.app` → 选型号 → "开始分析"
- AI 侧写标签显示「AI · 实时生成」= 后端通了;显示「真实生成示例」= 没连上(检查 env)
- 首次访问冷启动稍慢(~1-2s),之后快

## 说明
- DeepSeek key 只在 Vercel 后台环境变量里,不进前端,安全
- 函数有简易限流(每 IP 每分钟 20-30 次)防刷
- serverless 不持久化文件,原埋点不留存(demo 不需要)
