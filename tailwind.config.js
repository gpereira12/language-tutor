/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./*.{js,ts,jsx,tsx}",
        "./services/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                gold: '#C5A059',
                'gold-light': '#DFBD7D',
                cream: '#FDFBF7',
                navy: '#1A1C20',
                'wa-teal': '#00a884',
                'wa-dark': '#111b21',
                'wa-light': '#f0f2f5',
                'wa-chat-bg': '#efeae2',
                'wa-green-light': '#d9fdd3',
                'wa-white': '#ffffff',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                serif: ['Playfair Display', 'serif'],
            },
        },
    },
    plugins: [],
}
