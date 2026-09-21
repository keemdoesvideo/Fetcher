"""Pillow visual skins for Chat overlay export parity.

The browser Style Lab is CSS, while exported overlays are rendered with Pillow.
This module mirrors the ten visual looks closely enough that the downloaded file
uses the same selected skin instead of silently falling back to Classic.
"""

from __future__ import annotations

from . import chat_export_plus as plus
from .jobs import JobCancelled

LOOKS = {"classic", "y2k", "editorial", "glass", "messenger", "terminal", "cyber", "scrapbook", "win95", "manga"}


def normalise_look(value: str) -> str:
    value = str(value or "classic").strip().lower()
    return value if value in LOOKS else "classic"


def _theme(look: str, index: int):
    # Colors intentionally follow fetcher-chat-style-lab.css rather than inventing
    # a second export-only art direction.
    themes = {
        "y2k": dict(fill=(255,255,255,255), body=(20,20,20,255), border=(22,22,22,255), shadow=(22,22,22,255), badge_bg=(255,158,214,255), badge_fg=(22,22,22,255)),
        "editorial": dict(fill=(255,253,248,248), body=(29,28,26,255), border=(29,28,26,255), shadow=(50,40,25,28), badge_bg=(235,230,220,255), badge_fg=(29,28,26,255)),
        "glass": dict(fill=(20,23,32,172), body=(255,255,255,255), border=(255,255,255,52), shadow=(0,0,0,52), badge_bg=(255,255,255,30), badge_fg=(235,235,245,255)),
        "terminal": dict(fill=(2,12,6,242), body=(201,255,214,255), border=(55,239,121,190), shadow=(55,239,121,22), badge_bg=(2,12,6,255), badge_fg=(104,255,148,255)),
        "cyber": dict(fill=(10,15,30,246), body=(239,251,255,255), border=(77,234,255,255), shadow=(77,234,255,36), badge_bg=(77,234,255,28), badge_fg=(157,246,255,255)),
        "scrapbook": dict(fill=(255,247,223,255), body=(57,45,34,255), border=None, shadow=(67,49,29,72), badge_bg=(231,214,169,255), badge_fg=(74,57,38,255)),
        "win95": dict(fill=(192,192,192,255), body=(17,17,17,255), border=(255,255,255,255), shadow=(0,0,0,255), badge_bg=(192,192,192,255), badge_fg=(17,17,17,255)),
        "manga": dict(fill=(255,255,255,255), body=(17,17,17,255), border=(17,17,17,255), shadow=(17,17,17,255), badge_bg=(255,255,255,255), badge_fg=(17,17,17,255)),
    }
    if look == "messenger":
        outgoing = (index % 2) == 1
        return dict(
            fill=(125,83,232,255) if outgoing else (237,240,244,255),
            body=(255,255,255,255) if outgoing else (23,25,29,255),
            border=None,
            shadow=(24,28,35,28),
            badge_bg=(255,255,255,40) if outgoing else (210,214,222,255),
            badge_fg=(255,255,255,255) if outgoing else (23,25,29,255),
            outgoing=outgoing,
        )
    return themes.get(look)


def _draw_box(pil, draw, rect, style, look: str, theme: dict):
    x1,y1,x2,y2 = rect
    scale = style.width / 1920.0
    shadow = theme.get("shadow")

    if look == "y2k":
        off = max(3, round(7 * scale))
        draw.rounded_rectangle((x1+off,y1+off,x2+off,y2+off), radius=max(4,style.radius-3), fill=shadow)
        draw.rounded_rectangle(rect, radius=max(5,style.radius-2), fill=theme["fill"], outline=theme["border"], width=max(2,round(2*scale)))
        return
    if look == "editorial":
        off = max(1, round(4*scale))
        draw.rectangle((x1+off,y1+off,x2+off,y2+off), fill=shadow)
        draw.rectangle(rect, fill=theme["fill"])
        draw.rectangle((x1,y1,x1+max(3,round(4*scale)),y2), fill=theme["border"])
        return
    if look == "glass":
        off = max(2, round(5*scale))
        draw.rounded_rectangle((x1+off,y1+off,x2+off,y2+off), radius=style.radius+2, fill=shadow)
        draw.rounded_rectangle(rect, radius=style.radius+4, fill=theme["fill"], outline=theme["border"], width=max(1,round(scale)))
        # subtle highlight along the upper edge
        draw.line((x1+style.radius,y1+1,x2-style.radius,y1+1), fill=(255,255,255,38), width=max(1,round(scale)))
        return
    if look == "messenger":
        off = max(2, round(4*scale))
        draw.rounded_rectangle((x1+off,y1+off,x2+off,y2+off), radius=style.radius+3, fill=shadow)
        draw.rounded_rectangle(rect, radius=style.radius+5, fill=theme["fill"])
        return
    if look == "terminal":
        draw.rectangle((x1,y1,x2,y2), fill=theme["fill"], outline=theme["border"], width=max(1,round(scale)))
        return
    if look == "cyber":
        cut = max(8, round(18*scale))
        pts = [(x1,y1),(x2-cut,y1),(x2,y1+cut),(x2,y2),(x1+cut,y2),(x1,y2-cut)]
        draw.polygon(pts, fill=theme["fill"])
        draw.line(pts+[pts[0]], fill=theme["border"], width=max(2,round(3*scale)), joint="curve")
        draw.line((x2,y1+cut,x2,y2), fill=(255,72,210,200), width=max(1,round(scale)))
        return
    if look == "scrapbook":
        offx = max(2, round(4*scale)); offy=max(3,round(5*scale))
        draw.rectangle((x1+offx,y1+offy,x2+offx,y2+offy), fill=shadow)
        draw.rectangle(rect, fill=theme["fill"])
        tape_w=max(26,round(72*scale)); tape_h=max(7,round(16*scale))
        tx=x1+max(12,round(34*scale)); ty=y1-max(2,round(6*scale))
        draw.rectangle((tx,ty,tx+tape_w,ty+tape_h), fill=(226,196,139,194))
        return
    if look == "win95":
        draw.rectangle((x1+2,y1+2,x2+2,y2+2), fill=shadow)
        draw.rectangle(rect, fill=theme["fill"])
        w=max(2,round(2*scale))
        draw.line((x1,y2,x2,y2,x2,y1), fill=(74,74,74,255), width=w)
        draw.line((x1,y2,x1,y1,x2,y1), fill=(255,255,255,255), width=w)
        return
    if look == "manga":
        off=max(2,round(4*scale))
        draw.rounded_rectangle((x1+off,y1+off,x2+off,y2+off), radius=style.radius+2, fill=shadow)
        draw.rounded_rectangle(rect, radius=style.radius+2, fill=theme["fill"], outline=theme["border"], width=max(2,round(3*scale)))
        step=max(6,round(10*scale))
        for yy in range(y1+step, y2-step, step):
            for xx in range(x1+step, x2-step, step):
                if ((xx//step)+(yy//step)) % 2 == 0:
                    draw.ellipse((xx,yy,xx+max(1,round(1.6*scale)),yy+max(1,round(1.6*scale))), fill=(0,0,0,28))
        return


def _prepare_message(pil, message: dict, assets: dict, style, body_font, name_font, badge_font, bubble_width: str, look: str, index: int):
    dummy = pil.Image.new("RGBA", (8,8), (0,0,0,0))
    measure = pil.ImageDraw.Draw(dummy)
    inner_max = max(180, style.stack_width - 2*style.pad_x - 2*style.shadow_pad)
    line_h = max(style.emote_height, round(style.font_size*1.35))
    name_h = round(style.name_size*1.25)
    badge_h = max(round(style.badge_size*1.55), round(name_h*0.72))
    gap_after_name=max(3,round(style.font_size*0.18))
    badge_gap=max(3,round(style.font_size*0.18))

    badges=[]; name_x=0
    for badge in message.get("badges") or []:
        if not isinstance(badge,dict): continue
        label=plus.base._BADGES.get(str(badge.get("setId") or ""))
        if not label: continue
        bw=plus.base._text_width(measure,label,badge_font)+max(8,round(style.badge_size*.7))
        badges.append((label,bw)); name_x += bw+badge_gap

    user_name=str((message.get("user") or {}).get("displayName") or "viewer")
    display_name=user_name.upper() if look=="editorial" else user_name
    prefix="> " if look=="terminal" else ""
    user_w=plus.base._text_width(measure,prefix+display_name,name_font)
    name_row_w=name_x+user_w

    tokens=[]; x=0; line=0; line_widths=[0]; emote_margin=max(2,round(style.font_size*.08))
    for fragment in message.get("fragments") or []:
        if not isinstance(fragment,dict): continue
        emote_url=plus.base._normalise_url(fragment.get("emoteUrl") or "")
        asset=assets.get(emote_url) if emote_url else None
        if asset:
            token_w=asset.frames[0].width+emote_margin*2
            if x and x+token_w>inner_max:
                line+=1; x=0; line_widths.append(0)
            tokens.append(("emote",asset,x+emote_margin,line,token_w)); x+=token_w; line_widths[line]=max(line_widths[line],x); continue
        text=str(fragment.get("text") or "")
        for piece in plus.base._split_text(text):
            if not piece: continue
            is_space=piece.isspace(); token_w=plus.base._text_width(measure,piece,body_font)
            if is_space and x==0: continue
            if x and not is_space and x+token_w>inner_max:
                line+=1; x=0; line_widths.append(0)
            if is_space and x+token_w>inner_max:
                line+=1; x=0; line_widths.append(0); continue
            tokens.append(("text",piece,x,line,token_w)); x+=token_w; line_widths[line]=max(line_widths[line],x)
    if not tokens:
        fallback=str(message.get("text") or "")
        if fallback:
            tw=min(inner_max,plus.base._text_width(measure,fallback,body_font)); tokens=[("text",fallback,0,0,tw)]; line_widths=[tw]

    body_w=max(line_widths or [0]); lines=max(1,len(line_widths)); content_w=max(name_row_w,body_w,round(style.font_size*3.0))
    box_w=style.stack_width if bubble_width=="uniform" else min(style.stack_width,content_w+2*style.pad_x)
    box_h=style.pad_y*2+name_h+gap_after_name+lines*line_h
    canvas_w=box_w+style.shadow_pad*2; canvas_h=box_h+style.shadow_pad*2
    image=pil.Image.new("RGBA",(canvas_w,canvas_h),(0,0,0,0)); draw=pil.ImageDraw.Draw(image)
    rect=(style.shadow_pad,style.shadow_pad,style.shadow_pad+box_w,style.shadow_pad+box_h)
    theme=_theme(look,index)
    _draw_box(pil,draw,rect,style,look,theme)

    origin_x=style.shadow_pad+style.pad_x; origin_y=style.shadow_pad+style.pad_y
    # Windows 95 reserves a blue title bar behind the name row.
    if look=="win95":
        bar_h=name_h+max(5,round(style.pad_y*.7))
        draw.rectangle((rect[0]+3,rect[1]+3,rect[2]-3,rect[1]+3+bar_h), fill=(0,0,128,255))
        origin_y=rect[1]+3+max(1,round((bar_h-name_h)/2))

    cursor_x=origin_x
    for label,bw in badges:
        top=origin_y+max(0,(name_h-badge_h)//2)
        radius=0 if look in {"terminal","win95"} else max(3,round(style.badge_size*.3))
        draw.rounded_rectangle((cursor_x,top,cursor_x+bw,top+badge_h),radius=radius,fill=theme["badge_bg"],outline=theme.get("border") if look in {"terminal","manga"} else None,width=1)
        tw=plus.base._text_width(draw,label,badge_font)
        draw.text((cursor_x+(bw-tw)/2,top+max(0,(badge_h-style.badge_size)/2-1)),label,font=badge_font,fill=theme["badge_fg"])
        cursor_x += bw+badge_gap

    user_color=plus.base._safe_color((message.get("user") or {}).get("color") or "")
    if look=="terminal": user_color=(104,255,148,255)
    elif look=="win95" or (look=="messenger" and theme.get("outgoing")): user_color=(255,255,255,255)
    elif look in {"y2k","editorial","scrapbook","manga"} and not str((message.get("user") or {}).get("color") or "").strip(): user_color=theme["body"]
    draw.text((cursor_x,origin_y),prefix+display_name,font=name_font,fill=user_color)

    body_y=(rect[1]+3+name_h+max(5,round(style.pad_y*.7))+gap_after_name) if look=="win95" else (origin_y+name_h+gap_after_name)
    placements=[]
    for kind,payload,tx,line_index,_token_w in tokens:
        y=body_y+line_index*line_h
        if kind=="text": draw.text((origin_x+tx,y),str(payload),font=body_font,fill=theme["body"])
        else:
            asset=payload; ey=y+max(0,(line_h-asset.frames[0].height)//2)
            placements.append(plus.base.EmotePlacement(asset=asset,x=origin_x+tx,y=ey))

    try: at=float(message.get("at") or 0.0)
    except (TypeError,ValueError): at=0.0
    item=plus._Prepared(at=max(0.0,at),base=image,emotes=placements)
    if look=="messenger" and theme.get("outgoing"):
        item._fetcher_visual_x=max(8,round(style.width*.0115))
    return item


def prepare_messages(pil, payload: dict, assets: dict, style, job, bubble_width: str, look: str):
    look=normalise_look(look)
    if look=="classic":
        return plus._prepare_messages(pil,payload,assets,style,job,bubble_width)
    body_font=plus.base._font(pil,style.font_size,bold=False)
    # Terminal intentionally mirrors the browser's monospace feel when the user
    # has not explicitly replaced fonts downstream.
    name_font=plus.base._font(pil,style.name_size,bold=True)
    badge_font=plus.base._font(pil,style.badge_size,bold=True)
    messages=payload.get("messages") or []; prepared=[]; total=max(1,len(messages))
    for idx,message in enumerate(messages):
        if job.cancel_event.is_set(): raise JobCancelled()
        if isinstance(message,dict):
            prepared.append(_prepare_message(pil,message,assets,style,body_font,name_font,badge_font,bubble_width,look,idx))
        job.progress=13.0+5.0*((idx+1)/total)
    prepared.sort(key=lambda item:item.at)
    return prepared
