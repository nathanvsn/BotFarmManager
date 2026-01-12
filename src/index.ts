// ============================================
// Farm Manager Bot - Entry Point
// ============================================

import 'dotenv/config';
import { FarmBot } from './bot/FarmBot';
import { BotConfig } from './types';
import { Logger } from './utils/logger';

const logger = new Logger('Main');

// Carregar configuração do ambiente
function loadConfig(): BotConfig {
    const phpSessionId = process.env.PHPSESSID;

    if (!phpSessionId) {
        logger.error('PHPSESSID não configurado! Configure no arquivo .env');
        process.exit(1);
    }

    return {
        phpSessionId,
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

    const config = loadConfig();
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
