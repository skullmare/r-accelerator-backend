// Диагностика SMTP-подключения в обход nodemailer — отличает сетевую
// недоступность порта от рассинхрона TLS/секьюрности.
// Запуск из окружения, где крутится бэкенд (не локально!):
//   node scripts/diagnose-smtp.js
import 'dotenv/config';
import net from 'net';
import tls from 'tls';
import nodemailer from 'nodemailer';

const host = process.env.EMAIL_HOST;
const port = parseInt(process.env.EMAIL_PORT);
const secure = port === 465;

console.log(`Хост: ${host}, порт: ${port}, secure (implicit TLS): ${secure}`);

function rawTcpTest() {
    return new Promise((resolve) => {
        console.log('\n[1/3] Проверяю сырой TCP-коннект...');
        const start = Date.now();
        const socket = (secure ? tls : net).connect({ host, port, timeout: 10000 }, () => {
            console.log(`  TCP/TLS-соединение установлено за ${Date.now() - start}мс`);
        });

        socket.setTimeout(10000);
        socket.once('data', (data) => {
            console.log(`  Получен ответ от сервера (это и есть SMTP-приветствие): ${data.toString().trim()}`);
            socket.destroy();
            resolve(true);
        });
        socket.once('timeout', () => {
            console.log('  ТАЙМАУТ: TCP законнектился, но сервер НИЧЕГО не прислал за 10с.');
            console.log('  => Похоже на блокировку/проксирование порта платформой, либо неверный secure-режим.');
            socket.destroy();
            resolve(false);
        });
        socket.once('error', (err) => {
            console.log(`  ОШИБКА СОЕДИНЕНИЯ: ${err.code || err.message}`);
            console.log('  => Порт недоступен вообще (ECONNREFUSED/ETIMEDOUT/ENOTFOUND) — это сеть/хост/порт, не логин-пароль.');
            resolve(false);
        });
    });
}

async function nodemailerVerify() {
    console.log('\n[2/3] Проверяю через nodemailer.verify() (полный SMTP-хендшейк + auth)...');
    const transporter = nodemailer.createTransport({
        host, port, secure,
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
    });
    try {
        await transporter.verify();
        console.log('  OK: сервер принял соединение и авторизацию.');
    } catch (err) {
        console.log(`  ОШИБКА: ${err.message} (code: ${err.code})`);
    }
}

async function oppositeSecureTest() {
    const oppositePort = secure ? 587 : 465;
    console.log(`\n[3/3] Пробую альтернативный порт ${oppositePort} (secure: ${!secure}) — вдруг провайдер ждёт другой режим...`);
    const transporter = nodemailer.createTransport({
        host, port: oppositePort, secure: !secure,
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
    });
    try {
        await transporter.verify();
        console.log(`  OK на порту ${oppositePort}! Значит EMAIL_PORT/secure в .env настроены неверно — используйте порт ${oppositePort}.`);
    } catch (err) {
        console.log(`  Тоже не работает: ${err.message}`);
    }
}

const tcpOk = await rawTcpTest();
await nodemailerVerify();
await oppositeSecureTest();

if (!tcpOk) {
    console.log('\n=== ВЫВОД ===');
    console.log('Сырой TCP не получил ответа/приветствия от сервера. Это НЕ проблема логина/пароля в .env.');
    console.log('Проверьте: 1) блокирует ли хостинг исходящий трафик на этот порт;');
    console.log('           2) нет ли у провайдера почты требования отправлять именно с другого порта/протокола (напр. HTTP API вместо SMTP).');
}

process.exit(0);
