import React from "react";
import logo from "../../assets/logo-5.png";

const CheckEmail = () => {
    return (
        <div className="flex flex-col items-center w-full min-h-screen justify-center bg-[#050505] relative overflow-hidden py-10 px-4">
            {/* Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>

            <div className="relative z-10 flex flex-col items-center w-full max-w-md">
                <div className="w-full rounded-2xl border border-white/5 bg-[#0f0f0f]/80 p-8 shadow-2xl backdrop-blur-xl text-center flex flex-col items-center">
                    <div className="mb-8 text-center flex flex-col items-center">
                        <div className="flex items-center gap-2.5 mb-2">
                            <img src={logo} alt="Logo" className="h-9 w-9 object-contain" />
                            <span className="text-3xl font-extrabold tracking-tighter text-white">Boomerr</span>
                        </div>
                        <h1 className="text-base font-medium tracking-wide text-slate-400 mb-2">Check Your Email</h1>
                        <p className="text-slate-500 text-xs max-w-[280px]">
                            A verification link has been sent to your email address. Please check your inbox.
                        </p>
                    </div>

                    <p className="text-slate-300 text-sm leading-relaxed mb-8">
                        We've sent a secure link to your email. Click the link to activate your account and get started with Boomerr.
                    </p>

                    <a
                        href="/login"
                        className="inline-block w-full rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 active:scale-[0.98] transition-all"
                    >
                        BACK TO LOGIN
                    </a>
                </div>
            </div>
        </div>
    );
};

export default CheckEmail;
