// ============================================
// Farm Manager Bot - Entry Point
// ============================================

import 'dotenv/config';
import { FarmBot } from './bot/FarmBot';
import { BotConfig } from './types';
import { Logger } from './utils/logger';
import { AuthService } from './services/AuthService';

const logger = new Logger('Main');

// Carregar configuração do ambiente
async function loadConfig(): Promise<BotConfig> {
    const email = process.env.FARM_EMAIL;
    const password = process.env.FARM_PASSWORD;
    const manualSessionId = process.env.PHPSESSID;

    let phpSessionId: string | undefined;

    // Prioridade: login automático > sessão manual
    if (email && password) {
        const authService = new AuthService();
        try {
            phpSessionId = await authService.login(email, password);
        } catch (error) {
            logger.error('Falha no login automático', error as Error);
            process.exit(1);
        }
    } else if (manualSessionId) {
        logger.info('📋 Usando PHPSESSID manual do .env');
        phpSessionId = manualSessionId;
    } else {
        logger.error('❌ Nenhuma credencial configurada!');
        logger.error('Configure FARM_EMAIL e FARM_PASSWORD ou PHPSESSID no arquivo .env');
        process.exit(1);
    }

    return {
        phpSessionId,
        credentials: email && password ? { email, password } : undefined,
        checkIntervalMs: parseInt(process.env.CHECK_INTERVAL_MS || '60000', 10),
        siloSellThreshold: parseInt(process.env.SILO_SELL_THRESHOLD || '90', 10),
        debug: process.env.DEBUG === 'true',
    };
}

// Função principal
async function main(): Promise<void> {
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('   🌾 Farm Manager Bot v1.0.0');
    logger.info('   Automatizando suas fazendas com inteligência!');
    logger.info('═══════════════════════════════════════════════════════');

    const config = await loadConfig();
    logger.info(`Debug mode: ${config.debug ? 'ON' : 'OFF'}`);

    const bot = new FarmBot(config);

    // Graceful shutdown
    const shutdown = () => {
        logger.info('\n📴 Recebido sinal de encerramento...');
        bot.stop();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    try {
        await bot.start();
    } catch (error) {
        logger.error('Erro fatal ao iniciar bot', error as Error);
        process.exit(1);
    }
}

// Executar
main().catch((error) => {
    logger.error('Erro não tratado', error);
    process.exit(1);
});
