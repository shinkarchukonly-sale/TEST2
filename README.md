# GanttPro Proxy для калькулятора

Этот сервис позволяет выгружать данные из калькулятора трудозатрат напрямую в GanttPro.

## Установка на Vercel

### Шаг 1: Загрузите на GitHub

1. Создайте новый репозиторий на GitHub
2. Загрузите все файлы из этой папки в репозиторий

### Шаг 2: Подключите к Vercel

1. Зайдите на [vercel.com](https://vercel.com)
2. Нажмите "Add New" → "Project"
3. Выберите ваш репозиторий с ganttpro-proxy
4. Нажмите "Deploy"

### Шаг 3: Добавьте API ключ

1. После деплоя зайдите в Settings → Environment Variables
2. Добавьте переменную:
   - Name: `GANTTPRO_API_KEY`
   - Value: `ваш_api_ключ_ganttpro`
3. Нажмите Save
4. Перейдите в Deployments и нажмите "Redeploy"

### Шаг 4: Получите URL

После деплоя вы получите URL вида:
`https://your-project-name.vercel.app`

Этот URL нужно будет вставить в калькулятор.

## Использование

Калькулятор будет отправлять POST запросы на:
`https://your-project-name.vercel.app/api/ganttpro`

С данными:
```json
{
  "projectName": "Название проекта",
  "tasks": [
    { "name": "Аналитика", "hours": 0, "isSection": true },
    { "name": "Курирование", "hours": 10, "parentSection": "Аналитика" },
    ...
  ]
}
```

## Безопасность

- API ключ хранится в зашифрованных Environment Variables Vercel
- Ключ никогда не передаётся в браузер
- Все запросы проходят через HTTPS
