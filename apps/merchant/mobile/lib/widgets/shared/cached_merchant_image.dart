import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

class CachedMerchantImage extends StatelessWidget {
  const CachedMerchantImage({
    super.key,
    required this.imageUrl,
    this.fit = BoxFit.cover,
    this.width,
    this.height,
    this.alignment = Alignment.center,
    this.placeholderBuilder,
    this.errorBuilder,
  });

  final String imageUrl;
  final BoxFit fit;
  final double? width;
  final double? height;
  final Alignment alignment;
  final WidgetBuilder? placeholderBuilder;
  final WidgetBuilder? errorBuilder;

  @override
  Widget build(BuildContext context) {
    return CachedNetworkImage(
      imageUrl: imageUrl,
      fit: fit,
      width: width,
      height: height,
      alignment: alignment,
      fadeInDuration: const Duration(milliseconds: 120),
      placeholder: placeholderBuilder == null
          ? null
          : (context, _) => placeholderBuilder!(context),
      errorWidget: errorBuilder == null
          ? (_, _, _) => const Icon(Icons.broken_image_outlined)
          : (context, _, _) => errorBuilder!(context),
    );
  }
}

ImageProvider cachedMerchantImageProvider(String imageUrl) {
  return CachedNetworkImageProvider(imageUrl);
}
