# 把專案放到 GitHub Repo

## 一、本機先建好 Git（若尚未做過）

在專案根目錄（有 `package.json` 的那一層）執行：

```bash
# 1. 初始化 Git
git init

# 2. 加入所有檔案（.gitignore 會自動排除 node_modules、.env、dist 等）
git add .

# 3. 第一次提交
git commit -m "Initial commit: 藝術作品模擬圖網站"
```

## 二、在 GitHub 建立新 Repo

1. 登入 [GitHub](https://github.com)
2. 右上角 **+** → **New repository**
3. 填寫：
   - **Repository name**：例如 `artwork-mockup-generator`
   - **Description**（選填）：例如「藝術作品模擬圖網站」
   - **Public** 或 **Private** 自選
   - **不要**勾選 "Add a README"（你本地已有程式碼）
4. 按 **Create repository**

## 三、把本機專案推上去

建立好 Repo 後，GitHub 會顯示指令，或你在本機執行（把 `你的帳號`、`repo 名稱` 換成你的）：

```bash
# 加上遠端（網址換成你的 Repo）
git remote add origin https://github.com/你的帳號/repo名稱.git

# 推送到 main（第一次）
git push -u origin main
```

若本機預設分支是 `master` 而不是 `main`：

```bash
git branch -M main
git remote add origin https://github.com/你的帳號/repo名稱.git
git push -u origin main
```

## 四、之後要更新時

改完程式後：

```bash
git add .
git commit -m "說明這次改了什麼"
git push
```

## 注意

- **不要**把 `.env` 推上去（裡面有 key），專案已用 `.gitignore` 排除。
- 若曾不小心 `git add .env`，要先從追蹤移除再 commit：  
  `git rm --cached .env` 然後 `git commit -m "Remove .env from repo"`。
