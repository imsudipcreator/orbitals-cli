"use client";

import { authClient } from "@/lib/auth-client";
import { Github } from "lucide-react";
import Image from "next/image";
import { Button } from "./ui/button";


const LoginForm = () => {
    return (
        <div className="flex flex-col items-center justify-center">
            <Image src={"/secure-login.svg"} alt="Secure Login" width={200} height={100} className="" />
            <h1 className="font-medium text-3xl">Welcome back to orbital cli</h1>
            <p className="text-black/70">Login to your account to allow device flow</p>
            <div className="mt-4">
                <Button
                    onClick={() => {
                        authClient.signIn.social({
                            provider: "github",
                            callbackURL: "http://localhost:3000/",
                        })
                    }}
                >
                    <Github />
                    Continue with Github
                </Button>
            </div>
        </div>
    )
}
export default LoginForm