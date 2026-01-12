# 🌾 Farm Manager Bot

Bot automatizado para gerenciamento de fazendas no **Farm Manager** (farm-app.trophyapi.com).

> **Status:** Em desenvolvimento ativo 🚧

---

## 🎮 Funcionalidades

### ✅ Implementado

| Feature | Descrição |
|---------|-----------|
| **Auto Colheita** | Detecta e colhe automaticamente quando a plantação está madura |
| **Auto Cultivo** | Limpa (clearing) e ara (plowing) terrenos automaticamente |
| **Smart Seeding** | Seleciona a melhor semente baseado no `cropScore` do terreno |
| **Compra de Sementes** | Compra automaticamente sementes quando estoque está baixo |
| **Venda Automática** | Vende produtos do silo quando atinge % configurável |
| **Monitoramento do Silo** | Exibe status do silo a cada ciclo |

### 🔜 Roadmap

- [ ] Suporte a irrigação automática
- [ ] Fertilização automática
- [ ] Múltiplas contas
- [ ] Dashboard web para monitoramento
- [ ] Notificações via Telegram/Discord
- [ ] Análise de mercado para venda no melhor momento

---

## 🔐 Autenticação

O bot precisa de um `PHPSESSID` válido para funcionar. Existem **duas formas** de obtê-lo:

### Opção 1: Login com Email/Senha (Recomendado)

Se você sabe suas credenciais:

```env
FARM_EMAIL=seu_email@exemplo.com
FARM_PASSWORD=sua_senha
```

O bot fará login automaticamente e obterá o `PHPSESSID`.

### Opção 2: PHPSESSID Manual

Se você usa o app Android e não sabe as credenciais:

```env
PHPSESSID=seu_session_id_aqui
```

#### 📱 Como obter o PHPSESSID do app Android

O app Android parece usar autenticação persistente via **Device ID** ou **token local**, não email/senha. Para interceptar o PHPSESSID:

1. **Configurar proxy no celular:**
   - Instale [mitmproxy](https://mitmproxy.org/) ou [Charles Proxy](https://www.charlesproxy.com/)
   - Configure o proxy no WiFi do Android
   - Instale o certificado CA no dispositivo

2. **Interceptar requisições:**
   - Abra o app Farm Manager
   - Procure requisições para `farm-app.trophyapi.com`
   - Copie o valor do cookie `PHPSESSID`

3. **Colar no `.env`:**
   ```env
   PHPSESSID=f822tlif9cn4g15udj3bhln8t1
   ```

> ⚠️ **Nota:** O PHPSESSID pode expirar. Se o bot parar de funcionar, intercepte um novo.

#### 🔍 Investigando a autenticação do app

Ainda estamos investigando como o app mantém a sessão. Possibilidades:

- **Device ID:** O app envia um identificador único do dispositivo
- **Refresh Token:** Token salvo localmente que renova a sessão
- **Firebase Token:** Autenticação via FCM

Se você descobrir mais detalhes, contribua!

---

## 🚀 Instalação

```bash
# Clonar repositório
git clone https://github.com/seu-usuario/BotFarmManager.git
cd BotFarmManager

# Instalar dependências
npm install

# Configurar ambiente
cp .env.example .env
# Edite o .env com suas credenciais

# Rodar em desenvolvimento
npm run dev

# Build para produção
npm run build
npm start
```

---

## ⚙️ Configuração

| Variável | Descrição | Default |
|----------|-----------|---------|
| `FARM_EMAIL` | Email de login | - |
| `FARM_PASSWORD` | Senha de login | - |
| `PHPSESSID` | Session ID manual (alternativa ao login) | - |
| `CHECK_INTERVAL_MS` | Intervalo entre ciclos (ms) | `60000` |
| `SILO_SELL_THRESHOLD` | % do silo para venda automática | `90` |
| `DEBUG` | Ativar logs detalhados | `false` |

---

## 📁 Estrutura do Projeto

```
src/
├── api/
│   └── client.ts       # Cliente HTTP para a API
├── bot/
│   └── FarmBot.ts      # Lógica principal do bot
├── services/
│   ├── AuthService.ts  # Login e obtenção de sessão
│   ├── FarmService.ts  # Gerenciamento de fazendas
│   ├── SeedService.ts  # Smart Seeding
│   ├── SiloService.ts  # Monitoramento do silo
│   ├── MarketService.ts # Vendas no mercado
│   └── TractorService.ts # Gerenciamento de tratores
├── types/
│   └── index.ts        # Interfaces TypeScript
├── utils/
│   └── logger.ts       # Sistema de logs
└── index.ts            # Entry point
```

---

## 📝 Licença

ISC
