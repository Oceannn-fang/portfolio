/** fork 目标：用于探测 IPC 通道是否可用 */
process.send?.('worker-alive');
setTimeout(() => process.exit(0), 300);
