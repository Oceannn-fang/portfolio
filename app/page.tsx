import { Gk3Clone } from "@/components/Gk3Clone";
import { FontPicker } from "@/components/FontPicker";

export default function Page() {
  return (
    <>
      <Gk3Clone />
      {/* #64：字体挑选面板仅开发环境渲染；NODE_ENV 在构建期静态替换，
          生产构建该分支恒 false（不渲染 fp-root，用户线上无字体设置入口） */}
      {process.env.NODE_ENV !== "production" && <FontPicker />}
    </>
  );
}
