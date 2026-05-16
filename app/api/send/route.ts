import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  try {

    const body = await req.json()

    const data = await resend.emails.send({
      from: "onboarding@resend.dev",

      to: body.email,

      bcc: "audreiligorio@gmail.com",

      subject: "Recebemos sua história 💖",

      html: `
        <div
          style="
            font-family: Arial;
            background: #000;
            color: white;
            padding: 40px;
          "
        >

          <h1 style="color:#ec4899;">
            Sua história foi recebida 🎵
          </h1>

          <p style="font-size:18px;">
            Olá ${body.nome},
          </p>

         <p style="font-size:16px; line-height:1.6;">
  Recebemos sua solicitação com sucesso.
  Nossa equipe irá analisar sua história e em breve entraremos em contato pelo WhatsApp.
</p>

<hr style="margin:30px 0;border-color:#333;" />

<h2 style="color:#ec4899;">
  Dados do pedido
</h2>

<p><strong>Nome:</strong> ${body.nome}</p>

<p><strong>Email:</strong> ${body.email}</p>

<p><strong>WhatsApp:</strong> ${body.whatsapp}</p>

<p><strong>Cidade:</strong> ${body.cidade}</p>

<p><strong>Homenageado:</strong> ${body.homenageado}</p>

<p><strong>Data especial:</strong> ${body.data_especial}</p>

<p><strong>Estilo musical:</strong> ${body.estilo_musical}</p>

<p><strong>Artista inspiração:</strong> ${body.artista}</p>

<p><strong>Incluir nome na música:</strong> ${body.incluir_nome}</p>

<p style="margin-top:24px;">
  <strong>História:</strong>
</p>

<div
  style="
    background:#111;
    padding:20px;
    border-radius:16px;
    line-height:1.8;
    white-space:pre-wrap;
  "
>
  ${body.historia}
</div>

          <a
            href="https://wa.me/5511999999999"
            style="
              display:inline-block;
              margin-top:24px;
              background:#22c55e;
              color:white;
              padding:14px 24px;
              border-radius:14px;
              text-decoration:none;
              font-weight:bold;
            "
          >
            Continuar no WhatsApp 💬
          </a>

          <p style="margin-top:40px;color:#999;">
            Sua história. Sua Música.
          </p>

        </div>
      `,
    })

    console.log(data)

    return Response.json(
      { success: true },
      { status: 200 }
    )

  } catch (error) {

    console.log(error)

    return Response.json(
      { error },
      { status: 500 }
    )

  }
}