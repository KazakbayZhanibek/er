# Kompas application Worker

Worker принимает заявки с сайта, сохраняет их в D1 и отправляет письма через Resend. Без секретов и адреса получателя он отвечает `503` и не показывает пользователю ложный успех.

## Подготовка Cloudflare

Из корня проекта:

```sh
npx wrangler d1 create kompas-applications
```

Скопируйте выданный `database_id` в `application-worker/wrangler.toml`, затем примените миграцию:

```sh
npx wrangler d1 migrations apply kompas-applications --remote --config application-worker/wrangler.toml
```

## Секреты

После того как в Resend проверен домен отправителя, добавьте секреты. Значения не сохраняются в репозитории.

```sh
npx wrangler secret put RESEND_API_KEY --config application-worker/wrangler.toml
npx wrangler secret put APPLICATIONS_TO_EMAIL --config application-worker/wrangler.toml
npx wrangler secret put APPLICATIONS_FROM_EMAIL --config application-worker/wrangler.toml
```

`APPLICATIONS_FROM_EMAIL` имеет вид `Kompas <solicitudes@kompastrabajo.com>`. `APPLICATIONS_TO_EMAIL` — будущая рабочая почта менеджера.

## Развёртывание и подключение сайта

```sh
npx wrangler deploy --config application-worker/wrangler.toml
```

Команда покажет адрес `workers.dev`. Его можно использовать сразу либо подключить к Worker собственный адрес, например `applications.kompastrabajo.com`, в настройках Cloudflare. Проверьте `/health`, затем создайте локальный `.env.production.local` с фактическим адресом Worker:

```text
VITE_APPLICATION_API_URL=https://applications.kompastrabajo.com
```

После этого соберите и опубликуйте сайт. Пока переменная отсутствует, форма остаётся безопасным предпросмотром и не отправляет данные.

Перед включением рабочего адреса API необходимо согласовать текст об обработке персональных данных и срок хранения заявок. Сейчас в конфигурации стоит предварительный технический срок 30 дней. Затем отправьте тестовую заявку и убедитесь, что она появилась в D1, письмо пришло менеджеру, кандидат получил испанское подтверждение, а повтор с тем же идентификатором не создал дубль.
